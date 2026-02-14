/*
 * [utils/constants.js] - Exports all the values to be used around the project globally.
*/
const defaultUserAgent = "facebookexternalhit/1.1";
const headers = {
  "content-type": "application/x-www-form-urlencoded",
  "origin": "https://www.facebook.com",
  "referer": "https://www.facebook.com",
  "connection": "keep-alive",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1"
};

const meta = prop => new RegExp(`<meta property="${prop}" content="([^"]*)"`);

// Export all the constants.
module.exports = {
  meta,
  headers,
  defaultUserAgent
}