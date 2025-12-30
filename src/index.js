async function loginCore(cookie, options = {}, callback = undefined) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  
  // We go the async/await approach
  if (!callback) {
    let resolve = function () {};
    let reject = function () {};
    
    const loginCallback = (err, api) => {
      if (err) return reject(err);
      resolve(api);
    };
    
    return new Promise((resolveFunc, rejectFunc) => {
      resolve = resolveFunc;
      reject = rejectFunc;
      fb.login(cookie, options, loginCallback);
    });
  }
  
  // We go the callback-based approach.
  const handleCallback = (err, api) => {
    if (err) {
      utils.error("login", err);
      return callback(err);
    }
    callback(null, api);
  };
  
  let loginAttempts = 0;
  let MAX_LOGIN_ATTEMPTS = fb.getLoginOptions();
  
  (function loginQyberViaCallback() {
    if (loginAttempts === MAX_LOGIN_ATTEMPTS) {
      return handleCallback("Max login attempts reached. Relogin stopped to prevent account suspension.");
    }
    fb.login(cookie, { relogin: loginQyberViaCallback }, handleCallback);
  })(); // future todo: cleanup the previous fb.login() when using relogin()
}

/**
 * Handles login process using app state or credentials.
 * @param {Object} appState - Application state cookies.
 * @param {string} email - User email.
 * @param {string} password - User password.
 * @param {Object} apiCustomized - Custom API configurations.
 * @param {Function} callback - Callback function to handle login result.
 * @returns {Promise<void>}
 */
async function loginHelper(appState, apiCustomized, callback) {
  try {
    const jar = utils.getJar();
    utils.log("Logging in...");
    
    if (!appState || appState.length === 0) {
      throw new Error("No cookie found. Enter cookie (whether JSON/header string)");
    }
    
    // ----- Set Cookie to Jar -----
    
    const cookieFromArray = appState.map(c => [c.name || c.key, c.value].join('='))
    const cookieFromString = appState?.split(';')) || ''
      
    const cookies = cookieFromArray || cookieFromString
    
    cookies.map(cookieString => {
      const domain = ".facebook.com";
      const expires = new Date().getTime() + 1000 * 60 * 60 * 24 * 365;
      const str = `${cookieString}; expires=${expires}; domain=${domain}; path=/;`;
      jar.setCookie(str, `http://${domain}`);
    });
    
    // ----- Set API -----
    api = {
      setOptions: setOptions.bind(null, globalOptions),
      getAppState() {
        const appState = utils.getAppState(jar);
        if (!Array.isArray(appState)) return [];
        const uniqueAppState = appState.filter((item, index, self) => self.findIndex((t) => t.key === item.key) === index);
        return uniqueAppState.length > 0 ? uniqueAppState : appState;
      },
    };
    
    const mergedAppState = api.getAppState();
    const resp = await utils.get(fbLink(), jar, null, globalOptions, { noRef: true }).then(utils.saveCookies(jar));
    const [newCtx, newDefaultFuncs, apiFuncs] = await buildAPI(resp.body, jar);
    ctx = newCtx;
    defaultFuncs = newDefaultFuncs;
    api.addFunctions = (directory) => {
      const folder = directory.endsWith("/") ? directory : `${directory}/`;
      fs.readdirSync(folder).filter((v) => v.endsWith(".js")).forEach((v) => {
        api[v.replace(".js", "")] = require(`${folder}${v}`)(defaultFuncs, api, ctx);
      });
    };
    api.addFunctions(`${__dirname}/src`);
    api.listen = api.listenMqtt;
    api.refreshFb_dtsg = apiFuncs.refreshFb_dtsg;
    api.ws3 = { ...(apiCustomized && { ...apiCustomized }) };
    const userID = api.getCurrentUserID();
    if (resp?.request?.uri?.href?.includes(fbLink("checkpoint")) && resp.request.uri.href.includes("601051028565049")) {
      utils.warn(`Automated behavior detected on account ${userID}. This may cause auto-logout; resubmit appstate if needed.`);
      const bypassAutomation = await defaultFuncs.post(fbLink("api/graphql"), jar, {
        av: userID,
        fb_api_caller_class: "RelayModern",
        fb_api_req_friendly_name: "FBScrapingWarningMutation",
        variables: '{}',
        server_timestamps: true,
        doc_id: 6339492849481770,
        ...(ctx && {
          fb_dtsg: ctx.fb_dtsg,
          jazoest: ctx.jazoest
        })
      }, globalOptions);
    }
    utils.log("Connected to specified region.");
    const detectLocked = await checkIfLocked(resp, mergedAppState);
    if (detectLocked) throw detectLocked;
    const detectSuspension = await checkIfSuspended(resp, mergedAppState);
    if (detectSuspension) throw detectSuspension;
    utils.log("Successfully logged in.");
    const botInitialData = await api.getBotInitialData();
    if (!botInitialData.error) {
      utils.log(`Hello, ${botInitialData.name} (${botInitialData.uid})`);
      ctx.userName = botInitialData.name;
    } else {
      utils.warn(botInitialData.error);
      utils.warn(`WARNING: Failed to fetch account info. Proceeding to log in for user ${userID}`);
    }
    utils.log("To check updates: you may check on https://github.com/NethWs3Dev/ws3-fca");
    return callback(null, api);
  } catch (error) {
    return callback(error);
  }
}