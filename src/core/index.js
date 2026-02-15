/**
 * @fileoverview Core modules for the Axera FCA project.
 * @author Axera Team <jakedev0512@gmail.com>
 * @version 1.0.0
 */

const bus = require('./bus');
const events = require('./events');
const operation = require('./operation');
 
const { fbLink } = require('../utils');

/**
 * Refresh Facebook DTSG Token
 * @param {Object} options - The options object.
 * @param {string} options.userID - The userID of the Facebook account.
 * @param {Object} options.loginOptions - The login options object.
 * @param {import('../types').ApiClient} options.apiClient - The API client object.
 * @description The FB DTSG Token is used when making requests to their web pages.
 */
exports.refreshDTSG = async function refreshDTSG({ userID, loginOptions, apiClient }) {
  if (!userID) throw new Error('No userID provided, cannot refresh account DTSG.');
  if (!loginOptions) throw new Error('No loginOptions provided.')
  if (Object.keys(loginOptions).length === 0) throw new Error('Got empty loginOptions when refreshing DTSG. Please provide a loginOptions object.');
  
  const res = await apiClient.get({
    url: fbLink("ajax/dtsg/?__a=true"),
    query: null,
    globalOptions: loginOptions
  });
  
  const cleaned = res?.body?.replace('for (;;);', "");
  if (!cleaned) throw new Error("Got empty body when cleaning DTSG payload. Check the response object.");
  
  const parsed = JSON.parse(cleaned);
  if (Object.keys(parsed).length === 0) throw new Error("Got empty payload when refreshing DTSG.");
  
  /** @type {string | undefined} */
  const dtsg = parsed.payload?.token;
  if (!dtsg) throw new Error(`DTSG token missing from payload. Got type ${typeof dtsg} instead.`);

  /** @type {`2${string}` | undefined} */
  let jazoest = "2";
  for (const ch of dtsg) { jazoest += ch.charCodeAt(0); }

  const result = { fb_dtsg: dtsg, jazoest };
  
  // Save to current directory
  const filePath = "fb_dtsg_data.json";
  
  /** @type {import('../types').FB_ACCOUNT_DTSG} */
  const existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : {};
  existing[userID] = result;
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 4), "utf8");
  
  return result;
};


module.exports = {
  ...bus,
  ...events,
  ...operation
};