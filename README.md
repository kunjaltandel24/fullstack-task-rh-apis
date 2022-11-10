# TDL Image Server

## Build Setup

## required services
- **Stripe Account**
  - **secret_key** key is required in backend 
- **SMTP Service AWS/any**
  - if aws then required **access_key** as user and **secret_access_key** as password to SMTP service

```bash
# add env
$ cp sample.env .env // fill all variables with approprite values[dont use sample config values in production]

# install dependencies
$ npm install

# starts node process
$ npm start
```
