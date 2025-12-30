const { fbLink } = require('./core')

/**
 * Refresh Facebook DTSG Token
 * @param {string} userID - The userID of the Facebook account.
 * @description The FB DTSG Token is used when making requests to their web pages.
 */
exports.refreshDTSG = async function refreshDTSG(userID, loginOptions) {
  if (!userID) throw new Error('No userID provided, cannot refresh account DTSG.');
  if (!loginOptions) throw new Error('No loginOptions provided.')
  if (Object.keys(loginOptions).length === 0) throw new Error('Got empty loginOptions when refreshing DTSG. Please provide a loginOptions object.');
  
  const res = await utils.get({
    url: fbLink("ajax/dtsg/?__a=true"),
    qs: null,
    globalOptions: loginOptions
  });
  
  const cleaned = res?.body?.replace('for (;;);', "");
  if (!cleaned) throw new Error("Got empty body when cleaning DTSG payload. Check the response object.");
  
  const parsed = JSON.parse(cleaned);
  if (Object.keys(parsed).length === 0) throw new Error("Got empty payload when refreshing DTSG.");
  
  const dtsg = parsed.payload?.token;
  if (!dtsg) throw new Error(`DTSG token missing from payload. Got type ${typeof dtsg} instead.`);

  let jazoest = "2";
  for (const ch of dtsg) { jazoest += ch.charCodeAt(0); }

  const result = { fb_dtsg: dtsg, jazoest };
  
  // Save to current directory
  const filePath = "fb_dtsg_data.json";
  const existing = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : {};
  existing[userID] = result;
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 4), "utf8");
  
  return result;
};