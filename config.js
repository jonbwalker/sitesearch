const dotenv = require('dotenv');
dotenv.config();
module.exports = {
    searchUrl: process.env.SEARCH_URL,
    resultClass: process.env.RESULT_CLASS,
};
