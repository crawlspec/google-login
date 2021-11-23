const puppeteer = require('puppeteer-core');
const readline = require('readline');

const GOOGLE_LOGIN = process.env.GOOGLE_LOGIN || 'email@email.com';
const GOOGLE_PASSWORD = process.env.GOOGLE_PASSWORD || 'password';
const GOOGLE_RECOVERY_PHONE = process.env.GOOGLE_RECOVERY_PHONE || '5551234567';

const rlp = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

(async () => {
  let startTime = Date.now(), browser, page;
  try {
    browser = await puppeteer.connect({ browserWSEndpoint: 'wss://chromium.crawlspec.com' });

    console.log('connection successful!', (Date.now() - startTime)/1000);

    const url = 'https://accounts.google.com/ServiceLogin';
    page = await browser.newPage();
    await page.goto(url);
    await page.screenshot({ path: 'goto.png' });

    console.log('logging into', GOOGLE_LOGIN);
    await page.type('input[type="text"]:not(disabled)', GOOGLE_LOGIN);
    await page.keyboard.press('Enter');

    const passwordDiv = await waitForVisibleSelector(page, '#password');

    if (passwordDiv) {
      const passwordInput = await passwordDiv.$('input');
      await passwordInput.type(GOOGLE_PASSWORD);

      const [resp] = await Promise.all([
        page.waitForNavigation(),
        page.keyboard.press('Enter'),
      ]);

      if (!resp) {
        // Enter phone number for 2FA because Google does not recognize this device, should only need to do this once
        await page.screenshot({ path: 'challenge.png' });
        console.log('screenshot taken in challenge.png');

        const waitForVerifyDiv = new Promise(resolve => {
          setTimeout(async () => {
            const div = await page.evaluateHandle(() => {
              const divs = Array.from(document.querySelectorAll('div')).filter(e => /Get a verification code at/.test(e.textContent));
              if (divs.length) {
                return divs[divs.length - 1];
              }
            });
            if (div) {
              resolve(div);
            }
          }, 3000);
        });

        const challengeType = await Promise.race([
          waitForVerifyDiv,
          waitForVisibleSelector(page, 'input[type="tel"]:not(disabled)').then(el => el && 'enterNumber'),
          waitForVisibleSelector(page, '#smsButton').then(el => el && 'sms'),
        ]);

        if (!challengeType) {
          console.log('unrecognized challenge type, see challenge.png screenshot');
        } else {
          if (challengeType === 'sms') {
            await page.click('#smsButton');
          } else if (challengeType === 'enterNumber') {
            await page.type('input[type="tel"]:not(disabled)', GOOGLE_RECOVERY_PHONE);
          } else {
            await challengeType.click();
          }
          const [twoFactorCode] = await Promise.all([
            waitForInput('Enter 2FA code (just the numbers): '),
            waitForVisibleSelector(page, 'input[type="tel"]:not(disabled)'),
            page.keyboard.press('Enter'),
          ]);

          await page.type('input[type="tel"]:not(disabled)', twoFactorCode);

          const [resp] = await Promise.all([
            page.waitForNavigation(),
            page.keyboard.press('Enter'),
          ]);

          if (!resp) {
            const confirm = await page.evaluateHandle(() => {
              const spans = Array.from(document.querySelectorAll('span')).filter(e => /Confirm/.test(e.textContent));
              if (spans.length) {
                return spans[spans.length - 1];
              }
            });

            if (confirm) {
              await confirm.click();
            } else {
              console.log('unknown case, see screenshot.png');
            }
          } else {
            const confirm = await page.evaluateHandle(() => {
              const spans = Array.from(document.querySelectorAll('span')).filter(e => /not now/i.test(e.textContent));
              if (spans.length) {
                return spans[spans.length - 1];
              }
            });
            if (confirm) {
              await confirm.click();
            } else {
              console.log('unknown after login case, see screenshot.png');
            }
          }
        }
      }
    } else {
      console.log('not login page');
    }

    console.log('url', page.url());
    await page.screenshot({ path: 'screenshot.png' });
    console.log('screenshot taken in screenshot.png');

    await page.close();
  } catch (err) {
    console.log(new Date, err);
    if (page) {
      await page.screenshot({ path: 'error.png' });
      console.log('screenshot taken in error.png');
      await page.close();
    }
  } finally {
    if (browser) {
      console.log('disconnect browser');
      await browser.close();
    }
    process.exit();
  }
})();

async function waitForVisibleSelector(page, selector) {
  const element = await page.waitForSelector(selector);
  if (!element) {
    return null;
  }
  for (let i = 0; i < 100; i++) {
    const intersecting = await element.isIntersectingViewport();
    if (intersecting) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  console.log('finding element timed out', selector);
  return null;
}

function waitForInput(question) {
  return new Promise(resolve => rlp.question(question, input => resolve(input)));
}
