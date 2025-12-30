/*
* [utils/http/index.js] — HTTP request helper functions..
*/
const { getHeaders, getType, extractSubstringBetween } = require('../helpers');
const logger = require('../logging');

const { wrapper } = require('axios-cookiejar-support');
const tough = require('tough-cookie');
const qsLib = require('qs');
const http = require('http');
const https = require('https');
const axios = require("axios").default;

const axiosResponseWrapper = (res) => JSON.stringify({
    ...res,
    statusMessage: res?.statusText || undefined,
    statusCode: res?.status || undefined,
    headers: res?.headers || undefined,
    body: res?.data || undefined
    // mimic Request-style response temporarily to patch incompatibilities. 
});

class HttpClient {
  constructor({ proxy = null, jar = null, keepAlive = true, timeout = 60000, maxSockets = 20 } = {}) {
    this.jar = jar || new tough.CookieJar();
    this.keepAlive = !!keepAlive;
    this.proxy = this.constructor.normalizeProxy(proxy);
    this.timeout = timeout;
    this.maxSockets = maxSockets;
  }
  
  buildClient() {
    if (!this._axiosClient) this.#buildClient();
    return this;
  }
  
  #buildClient() {
    const agents = HttpRequest.getSharedAgents({ keepAlive: this.keepAlive, maxSockets: this.maxSockets });
    const config = {
      jar: this.jar,
      withCredentials: true, /*
      * Equivalent to { jar: true } in old request...
      * there's no { proxy }, as setProxy() will edit this later, which is the whole point of that setProxy() function.
      * reusability bro.
      */
      httpAgent: agents.http,
      httpsAgent: agents.https,
      timeout: this.timeout,
      proxy: this.proxy || false,
    }
    if (this.proxy) config.proxy = this.proxy;
    
    this._axiosClient = wrapper(axios.create(config));
  }
  
  get axiosClient() {
    if (!this._axiosClient) throw new Error("Axios client hasn't been initialized yet. use httpRequest.buildClient() to start the http client.");
    return this._axiosClient;
  }
  
  async #cleanGet(url) {
    try {
      const res = await this._axiosClient.get(url);
      return axiosResponseWrapper(res);
    } catch (error) {
      logger.error("[cleanGet]: An error occurred\n", error);
      throw new Error(error);
    }
  }

  async #get(parameters) {
    try {
      const { url, qs, options, ctx, customHeader } = this.constructor.parseArgs(parameters);
      
      if (!url || typeof url !== "string") throw new Error(`url must be a string. ${typeof url} was given.`);
      
      if (getType(qs) == "Object") {
        for (let prop in qs) {
          if (getType(qs[prop]) !== 'Object') continue;
          qs[prop] = JSON.stringify(qs[prop]);
        }
      }
      
      const requestOptions = {
        headers: getHeaders(url, options, ctx, customHeader),
        params: qs,
        paramsSerializer: params => qsLib.stringify(params, { arrayFormat: 'repeat' })
      }
    
      const res = await this._axiosClient.get(url, requestOptions);
      return axiosResponseWrapper(res);
    } catch (error) {
      logger.error("[get]: An error occurred\n", error);
      throw new Error(error);
    }
  }

  async #post(parameters) {
    try {
      const { url, form, options, ctx, customHeader } = this.constructor.parseArgs(parameters);
      const data = qsLib.stringify(form);
      
  	  const requestOptions = {
        headers: getHeaders(url, options, ctx, customHeader),
  	  }
	
      const res = await this._axiosClient.post(url, data, requestOptions);
      return axiosResponseWrapper(res);
    } catch (error) {
  	  logger.error("[post]: An error occurred\n", error);
  	  throw new Error(error);
    }
  }

  async #postFormData(params) {
    let client = this.axiosClient;
    try {
      const { url, form, qs, options, ctx } = this.constructor.parseArgs(params);
      
      // Build the FormData object
      const formData = new FormData();
      for (const key in form) {
        formData.append(key, form[key]);
      }
    
      if (getType(qs) == "Object") {
        for (let prop in qs) {
          if (getType(qs[prop]) !== 'Object') continue;
          qs[prop] = JSON.stringify(qs[prop]);
        }
      }
      
      const requestOptions = {
  	    headers: {
          ...getHeaders(url, options, ctx),
          ...formData.getHeaders() // sets proper Content-Type with boundary
        },
  	    params: qs,
  	    paramsSerializer: params => qsLib.stringify(params, { arrayFormat: 'repeat' }),
      }
      
      const res = await this._axiosClient.post(url, formData, requestOptions);
      return axiosResponseWrapper(res);
    } catch (error) {
      logger.error("[postFormData]: An error occurred\n", error);
      throw new Error(error);
    }
  }
  
  setProxy(proxyInput) {
    if (!proxyInput) throw new Error("Please provide a valid proxy when using setProxy(), everything will work even without a proxy. But it's recommended to use this if you've got a proxy.");
    const proxy = HttpClient.normalizeProxy(proxyInput);
    this.proxy = proxy;
  }
  
  getProxy() {
    return this.proxy;
  }
  
  setJar(newJar) {
    if (!(newJar instanceof tough.CookieJar)) throw new Error("Please pass in a valid tough-cookie CookieJar instance.");
    logger.warn("I hope you know what you're doing before setting a new jar to the axiosClient.");
    this.jar = newJar;
  }
  
  getJar() {
    return this.jar;
  }
  
  getClient() {
    if (!this._axiosClient) {
      throw new Error("HttpClient not initialized. Call buildClient() first.");
    }
    
    return Object.freeze({
      cleanGet: (args) => this.#cleanGet(args),
      get: (args) => this.#get(args),
      post: (args) => this.#post(args),
      postFormData: (args) => this.#postFormData(args),
    });
  }
  
  static parseArgs(args) {
    if (typeof args === "object" && args.url) {
      return args; // already an object, return as is
    } else {
      throw new Error("Arguments must be passed as a single object with a url field. You are making a request to an api.");
    }
  }
  
  // this an http.Agent module scoped factory
  static getSharedAgents({ keepAlive = true, maxSockets = 20 } = {}) {
    if (!this.#sharedAgentsCache) this.#sharedAgentsCache = new Map();
    
    const key = JSON.stringify({ keepAlive, maxSockets });
    
    if (!this.#sharedAgentsCache.has(key)) {
      this.#sharedAgentsCache.set(key, {
        http: new http.Agent({ keepAlive }),
        https: new https.Agent({ keepAlive }),
      });
    }
    return this.#sharedAgentsCache.get(key);
  }
  
  /**
   * Accepts:
   * - Object: { host, port, auth? }
   * - String: "http://host:port" or "http://user:pass@host:port"
   * Returns a plain object in Axios shape.
   */
  static normalizeProxy(input) {
    if (typeof input === 'object' && input !== null) {
      // Already an object; shallow-clone to avoid mutation.
      return { ...input };
    }
  
    if (typeof input === 'string') {
      // Ensure it has a protocol; URL parser needs one.
      const raw = input.startsWith('http://') || input.startsWith('https://') ? input : `http://${input}`;
  
      const url = new URL(raw);
      const proxy = {
        host: url.hostname,
        port: Number(url.port || 80),
      };
  
      if (url.username || url.password) {
        proxy.auth = {
          username: decodeURIComponent(url.username),
          password: decodeURIComponent(url.password),
        };
      }
      return proxy;
    }
  
    throw new TypeError('Proxy must be a string URL or an object');
  }
}

class ApiClient {
  constructor(httpFetch, options) {
    const { html = '', userID = '', ctx = {} } = options;
    
    this.requestCounter = 1;
    this.fb_dtsg = extractSubstringBetween(html, 'name="fb_dtsg" value="', '"');
    this.revision = extractSubstringBetween(html, 'revision":', ",");
    
    this.ttstamp = "2";
    for (let i = 0; i < this.fb_dtsg.length; i++) {
      this.ttstamp += this.fb_dtsg.charCodeAt(i);
    }
    
    this.userID = userID;
    this.ctx = ctx;
    
    this.#apiRequest = httpFetch;
    
    if (!this.#apiRequest || !(this.#apiRequest instanceof HttpClient)) throw new Error("No HttpClient instance provided. Please pass a new instance of HttpClient before using this class.");
  }
  
  get(url, jar, qs, localCtx, customHeader = {}) {
    const getConfig = {
      url,
      qs: this.buildFBApiParams(qs),
      globalOptions: this.ctx.globalOptions,
      ctx: localCtx || this.ctx,
      customHeader
    }
    return this.#apiRequest.get(getConfig);
  }
  post(url, jar, form, localCtx, customHeader = {}) {
    const postConfig = {
      url,
      qs: this.buildFBApiParams(form),
      globalOptions: this.ctx.globalOptions,
      ctx: localCtx || this.ctx,
      customHeader
    }
    return this.#apiRequest.post(postConfig);
  }
  postFormData(url, jar, form, qs, localCtx) {
    const postFormDataConfig = {
      url,
      form: this.buildFBApiParams(form),
      qs: this.buildFBApiParams(qs),
      globalOptions: this.ctx.globalOptions,
      ctx: localCtx || this.ctx,
    }
    return this.#apiRequest.postFormData(postFormDataConfig);
  }
    
  buildFBApiParams(overrides = {}, context = {}) {
    // So basically, this function saves us all the trouble of manually inserting these headers when requesting to Facebook APIs, so this function gives us already configured fetchers (get, post, postFormData).
    // (Jake) 4-30-25
    
    // This "params" contains the values Facebook wants when requesting to their APIs.
    // You'll see these values when you inspect your FB in chrome devtools.
    const params = {
      av: this.userID,
      __user: this.userID,
      __req: (this.requestCounter++).toString(36),
      __rev: this.revision,
      __a: 1,
      fb_dtsg: context.fb_dtsg || this.fb_dtsg,
      jazoest: context.ttstamp || this.ttstamp
    };
    
    if (!overrides) return params;

    for (const key in overrides) {
      if (!(key in params)) {
        params[key] = overrides[key];
      }
    }

    return params;
  }
}

module.exports = { HttpClient, ApiClient };