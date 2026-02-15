const ERROR_RETRIEVING = "Error retrieving userID. This can be caused by many factors, including being blocked by Facebook for logging in from an unknown location. Try logging in with a browser to verify.";

class LoginHelpers {
  static getFbURL(endpoint = '') {
    return `https://www.facebook.com${endpoint ? '/' + endpoint : ''}`;
  }
  
  /**
   * Concatenate cookies from jar
   * @param {import("tough-cookie").CookieJar} jar 
   */
  static async concatJarCookies(jar) {
    const fbCookies = jar.getCookies("https://www.facebook.com");
    const msCookies = jar.getCookies("https://www.messenger.com");
    return await Promise.all([fbCookies, msCookies]).then(([fb, ms]) => [...fb, ...ms]);
  }
  /**
   * Get app state from jar
   * @param {import("tough-cookie").CookieJar} jar 
   */
  static async getAppState(jar) {
    const appstate = await LoginHelpers.concatJarCookies(jar);
    const seen = new Set();
    
    const uniqueAppstate = [];

    for (const c of appstate) {
      const key = `${c.key}|${c.domain || ""}|${c.path || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueAppstate.push(c);
    }
  
    return uniqueAppstate.length ? uniqueAppstate : appstate;
  }
  
  static getMQTTEndpoint(html, { bypassRegion = false }) {
    console.log("Getting MQTT endpoint...");
    const MQTT_MATCHES = {
      oldFBMQTTMatch: html.match(/irisSeqID:"(.+?)",appID:219994525426954,endpoint:"(.+?)"/),
      newFBMQTTMatch: html.match(/{"app_id":"219994525426954","endpoint":"(.+?)","iris_seq_id":"(.+?)"}/),
      legacyFBMQTTMatch: html.match(/\["MqttWebConfig",\[\],{"fbid":"(.*?)","appID":219994525426954,"endpoint":"(.*?)","pollingEndpoint":"(.*?)"/),
    };
    
    let mqttEndpoint, irisSeqID, region;
    
    for (const [key, match] of Object.entries(MQTT_MATCHES)) {
      if (!match || bypassRegion) continue;
      
      switch (key) {
        case "oldFBMQTTMatch":
          mqttEndpoint = match[2].replace(/\\\//g, "/");
          irisSeqID = match[1];
          region = this.getAccountRegion(mqttEndpoint);
          break;
        case "newFBMQTTMatch":
          mqttEndpoint = match[1].replace(/\\\//g, "/");
          irisSeqID = match[2];
          region = this.getAccountRegion(mqttEndpoint);
          break;
        case "legacyFBMQTTMatch":
          mqttEndpoint = match[2].replace(/\\\//g, "/");
          region = this.getAccountRegion(mqttEndpoint);
          break;
        default:
          throw new Error(`Unexpected MQTT_MATCH key: ${key}, No FB MQTT match found, FB might added breaking changes recently, please report this issue to the developer.`);
      }
    }
    
    console.log("Retrieved MQTT server endpoint.");
    
    return {
      mqttEndpoint,
      irisSeqID,
      region,
    };
  }
  
  static getAccountRegion(mqttEndpoint) {
    if (!mqttEndpoint) throw new Error("MQTT endpoint is not provided");
    console.log("Retrieved MQTT server region.");
    return new URL(mqttEndpoint).searchParams.get("region").toUpperCase();
  }
  
  static getClientID(html) {
    const clientID = html.match(/\["MqttWebDeviceID",\[\],{"clientID":"(.*?)"/);
    return clientID ? clientID[1] : null;
  }
  static getDeviceID(html) {
    const deviceID = html.match(/\["AnalyticsCoreData",\[\],{"device_id":"(.*?)"/);
    return deviceID ? deviceID[1] : null;
  }
  
  /**
   * Get user ID from cookies
   * @param {import('tough-cookie').Cookie[]} cookies 
   * @returns
   */
  static getUserID(cookies) {
    const primaryProfile = cookies.find(cookie => cookie.key === "c_user");
    const secondaryProfile = cookies.find(cookie => cookie.key === "i_user");
    return (primaryProfile ? primaryProfile : secondaryProfile) || null;
  }
  
  /**
   * Get irisSeqID from HTML
   * @param {string} html 
   * @returns {string | null}
   */
  static getIrisSeqID(html) {
    const irisSeqIDMatch = html.match(/irisSeqID:"(.+?)"/);
    return irisSeqIDMatch ? irisSeqIDMatch[1] : null;
  }
  
  /**
   * Check if the current state of the web page has been blocked by Facebook
   * @param {string} html 
   * @returns {boolean}
   */
  static isCheckpoint(html) {
    return html.includes("/checkpoint/block/?next");
  }
  
  static getScriptTagsFromHTML(html) {
    /** @type {Array<object>} */
    const allScriptsData = [];
    const scriptRegex = /<script type="application\/json"[^>]*>(.*?)<\/script>/g;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
      try {
        allScriptsData.push(JSON.parse(match[1]));
      } catch (e) {
        console.error(`Failed to parse a JSON blob from HTML`, e.message);
      }
    }
    return allScriptsData;
  };
  
  static findConfig(html) {
    const netData = this.getScriptTagsFromHTML(html);
    return (key) => {
      for (const scriptData of netData) {
        if (scriptData.require) {
          for (const req of scriptData.require) {
            if (Array.isArray(req) && req[0] === key && req[2]) {
              return req[2];
            }
            if (Array.isArray(req) && req[3] && req[3][0] && req[3][0].__bbox && req[3][0].__bbox.define) {
              for (const def of req[3][0].__bbox.define) {
                if (Array.isArray(def) && def[0].endsWith(key) && def[2]) {
                  return def[2];
                }
              }
            }
          }
        }
      }
      return null;
    };
  };
  
  /**
   * Build session context from cookies
   * @param {string} html 
   * @param {import('tough-cookie').CookieJar} jar 
   * @returns 
   */
  static async buildSessionContext(html, jar) {
    const cookies = await jar.getCookies(fbLink());
    const userID = this.getUserID(cookies);
    
    if (!userID) {
      throw new Error(ERROR_RETRIEVING);
    }
    
    if (this.isCheckpoint(html)) {
      console.warn("login", "Checkpoint detected. Please log in with a browser to verify.");
      throw new Error("FB Checkpoint detected");
    }
    
    const deviceID = this.getDeviceID(html);
    const clientID = this.getClientID(html);
    const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
    const irisSeqID = this.getIrisSeqID(html);
    
    let region = this.getAccountRegion(html);
    
    if (!region) {
      const regions = ["prn", "pnb", "vll", "hkg", "sin", "ftw", "ash"];
      region = regions[Math.floor(Math.random() * regions.length)].toUpperCase();
      console.warn("No MQTT region is found from this account, now using random region. This might raise API suspicions.");
    }
    
    const mqttEndpoint = `wss://edge-chat.messenger.com/chat?region=${region}${identities.clientID ? `&cid=${clientID}` : ''}&sid=${sessionID}`;
    
    return {
      mqttEndpoint,
      region,
      
      userID,
      deviceID,
      clientID,
      sessionID,
      lastSeqId: irisSeqID,
      
      jar,
      
      firstListen: true,
      loggedIn: true,
      
      access_token: "NONE",
      clientMutationId: 0,
      mqttClient: undefined,
      syncToken: undefined,
      
      wsReqNumber: 0,
      wsTaskNumber: 0,
      reqCallbacks: {},
      ...dtsgResult,
    }
  }
  
  /**
   * Creates an instance of ApiClient.
   * @param {HttpClient} httpClient - The HTTP client instance.
   * @param {string} html - The HTML content.
   * @param {string} userID - The user ID.
   * @param {import('../types').UserSessionContext} sessionContext - The user session context.
   * @returns {Promise<import('../types').ApiClient>} - The created ApiClient instance.
   */
  static async createApiClient({ httpClient, html, userID, sessionContext }) {
    if (!httpClient || !html || !userID || !sessionContext) {
      throw new Error("httpClient, html, userID, and sessionContext are required");
    }
    if (!(httpClient instanceof HttpClient)) {
      throw new Error("httpClient must be an instance of HttpClient");
    }
    const ApiClient = (await import("../http/apiClient")).default;
    if (!ApiClient) {
      throw new Error("Failed to import ApiClient");
    }
    const apiClient = new ApiClient({
      httpClient,
      html,
      userID,
      sessionContext,
    });
    return apiClient;
  }
}

async function buildAPI(html, jar) {
  const cookies = jar.getCookies(fbLink());
  const primaryProfile = cookies.find((val) => val.cookieString().startsWith("c_user="));
  const secondaryProfile = cookies.find((val) => val.cookieString().startsWith("i_user="));
  
  if (!primaryProfile && !secondaryProfile) {
    throw new Error(ERROR_RETRIEVING);
  }
  
  if (html.includes("/checkpoint/block/?next")) {
    utils.warn("login", "Checkpoint detected. Please log in with a browser to verify.");
    throw new Error("Checkpoint detected");
  }
  
  const userID = secondaryProfile?.cookieString().split("=")[1] || primaryProfile.cookieString().split("=")[1];
  
  const findConfig = LoginHelpers.findConfig(html);
  
  utils.log("Logged in!");
  utils.log("Choosing the best region...");
  
  const requiredInitialData = {
    dtsgData: findConfig("DTSGInitialData"),
    clientIDData: findConfig("MqttWebDeviceID"),
    mqttConfigData: findConfig("MqttWebConfig"),
    currentUserData: findConfig("CurrentUserInitialData")
  };
  const { dtsgData, clientIDData, mqttConfigData, currentUserData } = requiredInitialData;
  
  const dtsg = dtsgData ? dtsgData.token : utils.getFrom(html, '"token":"', '"');
  const dtsgResult = { fb_dtsg: dtsg, jazoest: `2${Array.from(dtsg).reduce((a, b) => a + b.charCodeAt(0), '')}` };

  const clientID = clientIDData ? clientIDData.clientID : undefined;
  const mqttAppID = mqttConfigData ? mqttConfigData.appID : undefined;
  const userAppID = currentUserData ? currentUserData.APP_ID : undefined;

  const primaryAppID = userAppID || mqttAppID;

  const mqttEndpoint = mqttConfigData ? mqttConfigData.endpoint : undefined;

  const region = mqttEndpoint ? new URL(mqttEndpoint).searchParams.get("region")?.toUpperCase() : undefined;
  const irisSeqIDMatch = html.match(/irisSeqID:"(.+?)"/);
  const irisSeqID = irisSeqIDMatch ? irisSeqIDMatch[1] : null;
  
  const deviceID = LoginHelpers.getDeviceID(html);
  const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
  
  if (globalOptions.bypassRegion) {
    region = globalOptions.bypassRegion.toUpperCase();
    utils.warn("Bypass region is enabled. This is an experimental feature yet, doesn't guarantee the effectiveness.")
  }
  if (!region) {
    const regions = ["prn", "pnb", "vll", "hkg", "sin", "ftw", "ash"];
    region = regions[Math.floor(Math.random() * regions.length)].toUpperCase();
    utils.warn("No region is specified from this account, now using random region. This doesn't guarantee the effectiveness.");
  }
  
  if (globalOptions.bypassRegion && mqttEndpoint) {
      const currentEndpoint = new URL(mqttEndpoint);
      currentEndpoint.searchParams.set('region', globalOptions.bypassRegion.toLowerCase());
      mqttEndpoint = currentEndpoint.toString();
  }
  
  mqttEndpoint = `wss://edge-chat.messenger.com/chat?region=${region}${identities.clientID ? `&cid=${clientID}` : ''}&sid=${sessionID}`;
  
  utils.log("Region specified:", region);
  utils.log("MQTT Endpoint:", mqttEndpoint);
  utils.log("MQTT Session ID:", sessionID);
  utils.log("MQTT Web Client ID:", clientID);
  utils.log("MQTT Web Device ID:", deviceID);
  ctx = {
    userID,
    jar,
    clientID,
    sessionID,
    globalOptions,
    loggedIn: true,
    access_token: "NONE",
    clientMutationId: 0,
    mqttClient: undefined,
    lastSeqId: irisSeqID,
    syncToken: undefined,
    mqttEndpoint,
    wsReqNumber: 0,
    wsTaskNumber: 0,
    reqCallbacks: {},
    region,
    firstListen: true,
    ...dtsgResult,
  };
  defaultFuncs = utils.makeDefaults(html, userID, ctx);
  return [ctx, defaultFuncs, {
    refreshFb_dtsg
  }];
}

module.exports = LoginHelpers;