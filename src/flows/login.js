const fs = require("node:fs");
const { CookieJar } = require("tough-cookie");

const EVENTS = require("../core/events");
const Operation = require("../core/operation");
const { EventBus, EventDomain } = require("../core/bus");

const ApiRegistry = require("../api/registry");

const { HttpClient } = require("../http/client");
const LoginHelpers = require("./loginHelpers");

// THIS FILE STRICTLY HAS CORE LOGIC, NO Adapters.

/**
 * @typedef {import("../types").FCAOptions} FCAOptions
 * @typedef {import("../types").Operation} Operation
 */

/**
 * Step 1: Get jar
 * Step 2: Set cookie
 */
class LoginFlow {
  #cookie;
  #jar;
  #operation;
  #fcaOptions;
  /** @type {import("../types").UserSessionContext} */
  #userSessionContext;
  
  #httpClient;
  #apiRegistry;
  
  #bus;
  
  /**
   * Error handler for LoginFlow.
   * @param {Error & { name: string, critical: boolean }} err
   */
  static errorHandler(err) {
    if (err instanceof Error) {
      err.name = "LoginError";
      err.critical = true;
    }
    throw err;
  }
  
  /**
   * Initialize the LoginFlow instance.
   * @param {{ cookie: import("tough-cookie").Cookie[], options: FCAOptions, operation: Operation }} loginParameters 
   */
  constructor({ cookie, options, operation }) {
    this.#operation = operation instanceof Operation ? operation : new Operation({ timeout: options.timeout || 20000 });
    
    this.#jar = new CookieJar();
    this.#cookie = cookie;
    this.#fcaOptions = options;
    
    this.#httpClient = new HttpClient(options.httpClientSettings).buildClient().getClient();
    this.#apiRegistry = new ApiRegistry();
    
    this.api = this.#apiRegistry.expose();
    this.cancelled = false;
  }
  
  /**
   * Inject cookies to in-memory cookie jar to use API requiring a session.
   * @param {import("tough-cookie").Cookie[]} cookie 
   * @param {import("tough-cookie").CookieJar} jar 
   */
  async #applyInitialCookiesToJar(cookie, jar) {
    if (!cookie) throw new Error("No cookie found. Enter cookie (whether JSON/header string)");
    const cookies = Array.isArray(cookie) ? cookie.map(c => [c.name || c.key, c.value].join('=')) : cookie?.split(';');
    
    await Promise.all(cookies?.map(async cookieString => {
      const domain = ".facebook.com";
      const expires = new Date().getTime() + 1000 * 60 * 60 * 24 * 365;
      const str = `${cookieString}; expires=${expires}; domain=${domain}; path=/;`;
      await jar.setCookie(str, `http://${domain}`);
    }));
  }
  
  async #getHTML() {
    const options = this.#fcaOptions;
    const html = await this.#httpClient.get(LoginHelpers.getFbURL(), this.#jar, null, options, { noRef: true });
    await utils.saveCookies(this.#jar);
    return html;
  }
  
  /**
   * Build user session context from the flow.
   * @param {string} html 
   * @param {import('tough-cookie').CookieJar} jar 
   */
  async #buildSessionContext(html, jar) {
    const sessionContext = await LoginHelpers.buildSessionContext(html, jar);
    this.#setSessionContext(sessionContext);
    return sessionContext;
  }
  
  /**
   * Create the API client that will be used by the FCA functions.
   * @param {string} html 
   * @param {import('../types').UserSessionContext} sessionContext
   */
  async #createAPIClient(html, sessionContext) {
    return await LoginHelpers.createApiClient({
      httpClient: this.#httpClient,
      html,
      userID: this.#userSessionContext.userID,
      sessionContext
    });
  }
  
  #loadAPIFunctions(apiClient, apiCollectionPath) {
    if (!apiClient) {
      throw new Error("API client is missing in this FCA. Possible reasons include incorrect configuration or missing dependencies.");
    }
    if (!apiCollectionPath) {
      throw new Error("API functions are missing in this FCA.");
    }
    
    const LOADED_API_FUNCTIONS = [];
    const apiPath = path.join(__dirname, "..", "api");
    const apiFiles = fs
      .readdirSync(apiPath)
      .filter(name => fs.lstatSync(path.join(apiPath, name)).isDirectory());

    apiFiles.forEach(file => {
      const modulePath = path.join(apiPath, file);
      fs.readdirSync(modulePath)
        .filter(file => file.endsWith(".js"))
        .forEach(file => {
          const moduleName = path.basename(file, ".js");
          const fullPath = path.join(modulePath, file);
          
          try {
            const apiModule = require(fullPath)(apiClient, api, ctx);
            LOADED_API_FUNCTIONS.push(apiModule);
          } catch (e) {
            utils.error(`Failed to load module ${moduleName} from ${fullPath}:`, e);
          }
        });
    });
    
    this.#apiRegistry.bulkLoadToRegistry(LOADED_API_FUNCTIONS);
    this.api = this.#apiRegistry.expose(); // refresh surface
  }
  
  /**
   * Set user session context to the flow.
   * @param {import('../types').UserSessionContext} sessionContext
   */
  #setSessionContext(sessionContext) {
    this.#userSessionContext = sessionContext;
  }
  
  addAPI(name, fn) {
    // It is in memory for now but will be persisted to disk later
    // This is made so hooking into the API is easier
    this.#apiRegistry.add(name, fn);
    this.api = this.#apiRegistry.expose(); // refresh surface
  };
  
  removeAPI(name) {
    this.#apiRegistry.remove(name);
    this.api = this.#apiRegistry.expose(); // refresh surface
  };

  getAPI(name) {
    return this.#apiRegistry.get(name);
  }
  
  setBusNotifier(bus) {
    if (!bus || !(bus instanceof EventBus || bus instanceof EventDomain)) return;
    
    this.#bus = bus;
    
    /** @param {{ operation: import("../types").Operation, step: string }} event */
    return (event) => {
      this.#bus.emit(EVENTS.PROGRESS, event);
    }
  }

  /** @param {EventBus | EventDomain} bus */
  async #startLoginProcess(bus) {
    const op = this.#operation;
    try {
      console.log("Logging in...");
      if (op.getStatus().cancelled) throw op.reason;
      
      // do cookies, ctx, buildAPI, etc
      const notify = this.setBusNotifier(bus);
      
      if (notify) notify({ operation: op, step: "cookies" });
      if (op.getStatus().cancelled) throw op.reason;
      
      this.#cookie = await LoginHelpers.getAppState(this.#jar);
      await this.#applyInitialCookiesToJar(this.#cookie, this.#jar);
      
      if (notify) notify({ operation: op, step: "get_html_data" });
      if (op.getStatus().cancelled) throw op.reason;
      
      const html = await this.#getHTML();
      
      if (notify) notify({ operation: op, step: "build_session_context" });
      if (op.getStatus().cancelled) throw op.reason;
      
      await this.#buildSessionContext(html, this.#jar);
      
      if (notify) notify({ operation: op, step: "create_api_client" });
      if (op.getStatus().cancelled) throw op.reason;
      
      const apiClient = await this.#createAPIClient(html, this.#userSessionContext); // i think this will be attached to fca api options onload
      
      if (notify) notify({ operation: op, step: "load_api_functions" });
      if (op.getStatus().cancelled) throw op.reason;
      
      this.#loadAPIFunctions(apiClient, apiFunctions);
      
      if (notify) notify({ operation: op, step: "success_login" });
      if (op.getStatus().cancelled) throw op.reason;
      
      // extras
      this.addAPI("getAppState", LoginHelpers.getAppState);
      
      const ctx = this.#userSessionContext
      console.log("MQTT Region:", ctx.region);
      console.log("MQTT Endpoint:", ctx.mqttEndpoint);
      console.log("MQTT Session ID:", ctx.sessionID);
      console.log("MQTT Web Client ID:", ctx.clientID);
      console.log("MQTT Web Device ID:", ctx.deviceID);
      
      /** Do not confuse apiClient with api, as they serve different purposes. `apiClient` refers to the API client instance, while `api` refers to the API functions loaded into the flow. You want api. */
      return { api: this.api, session: ctx };
    } catch (error) {
      LoginFlow.errorHandler(error);
    }
  }
  
  /**
   * Runs the login flow.
   * @param {EventBus | EventDomain} bus - The event bus or domain to use for notifications.
   * @returns {Promise<{ success: boolean, api: import('../types').ApiRegistry['API'], error: Error | null, cancelled: boolean }>} The result of the login flow.
   */
  async run(bus) {
    try {
      const login = await this.#startLoginProcess(bus);
      return { success: true, api: login.api, error: null, cancelled: this.cancelled };
    } catch (err) {
      return { success: false, api: this.api, error: err, cancelled: this.cancelled };
    }
  }
}

module.exports = LoginFlow;