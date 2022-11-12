# Image Gallery Backend

- Clone Both [image-gallery-client](https://github.com/kunjaltandel24/image-gallery-client) and [image-gallery](https://github.com/kunjaltandel24/image-gallery) in single folder and Follow the steps mentioned below.

## required services

- **Stripe Account**
  - **secret_key** key is required in backend
  - complete the platform profile to enable connected accounts for payout to image owners
  - create endpoint for checkout session webhook event and copy the secret and paste it in .env file
  - For now **Coupons** can be created only from stripe dashboard.
- **SMTP Service AWS/any**
  - **SES_HOST** SMTP host is required to send outgoing mail request.
  - **SES_EMAIL** any email enable in your enabled in your Mail Server of SMTP host.
  - if aws then required **access_key** as user and **secret_access_key** as password to SMTP service
- **MongoDB** connection string from local/atlas is required

## Build Setup
```bash
# add env
$ cp sample.env .env // fill all variables with approprite values[dont use sample config values in production]

# install dependencies
$ npm install

# build
$ npm run build

# starts node process
$ npm start
```
