# google-login

This repository contains a collection of scripts to automate Google login using the Crawlspec service to run the browser remotely. For questions, feel free to submit a Github issue

## Puppeteer (javascript)

Source code in [puppeteer.js](https://github.com/crawlspec/google-login/blob/main/puppeteer.js) of this repo. You can modify to fit your own needs

#### Usage

* Note, you'll need to input your recovery phone number on first usage to reply the message for Two-factor authentication but not for subsequent usage

```
npm install
GOOGLE_LOGIN=email@gmail.com \
GOOGLE_PASSWORD=password \
GOOGLE_RECOVERY_PHONE=5551234567 node puppeteer
```


## Selenium (python)

TODO...
