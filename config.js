const dotenv = require('dotenv');
dotenv.config();
module.exports = {
    searchUrl: process.env.SEARCH_URL,
    resultClass: process.env.RESULT_CLASS,
    twilioConfig: {
        enabled: process.env.TWILIO_ENABLED,
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        toPhoneNumber: process.env.TWILIO_TO_PHONE_NUMBER,
        fromPhoneNumber: process.env.TWILIO_FROM_PHONE_NUMBER,
    }
};
