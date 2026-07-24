'use strict';

const crypto = require('crypto');

const password = crypto.randomBytes(18).toString('base64url');
const salt = crypto.randomBytes(32).toString('hex');
const pin = String(crypto.randomInt(100000, 1000000));

console.log(`DAPUR_RINI_ADMIN_PASSWORD=${password}`);
console.log(`DAPUR_RINI_PASSWORD_SALT=${salt}`);
console.log(`DAPUR_RINI_DEVICE_PIN=${pin}`);
