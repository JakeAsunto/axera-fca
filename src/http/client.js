
/*
* [utils/http/index.js] — HTTP request helper functions..
*/
const { getHeaders, getType } = require('../utils/helpers');
const logger = require('../utils/logging');

const { HttpCookieAgent, HttpsCookieAgent } = require('http-cookie-agent/http');

const tough = require('tough-cookie');
const qsLib = require('qs');
const axios = require("axios").defaults;

/**
 *
 * @param {import('axios').AxiosResponse} res 
 * @returns {import('../types').HttpClientResponse}
 */
const axiosResponseWrapper = (res) => ({
  url: res.config.url,
  statusCode: res.status,
  statusMessage: res.statusText,
  headers: res.headers,
  body: res.data,
  method: res.config.method
});

const axiosClient = Symbol('axiosClient');
const sharedAgentsCache = Symbol('sharedAgentsCache');
  
class HttpClient {
  /** @type {Map<string, { http: import('http').Agent, https: import('https').Agent }>} */
  static [sharedAgentsCache];
  /** @type {import('axios').AxiosInstance}*/
  [axiosClient];
  #jar;
  
  
  /**
    * Accepts:
    * - Object: { host, port, auth? }
    * - String: "http://host:port" or "http://user:pass@host:port"
    * Returns a plain object in Axios shape.
    * @param {object | string} input - The input to normalize.
    * @returns {object | null} - The normalized proxy object.
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
    
    return null;
  }
  
  // this an http.Agent module scoped factory
  /**
   * 
   * @param {{ jar?: import('tough-cookie').CookieJar | null, keepAlive?: boolean | true, maxSockets?: number | 20 }} getSharedAgentsOptions
   * @returns 
   */
  static getSharedAgents({ jar = null, keepAlive = true, maxSockets = 20 } = {}) {
    if (!jar || !(jar instanceof tough.CookieJar)) {
      throw new Error('Invalid cookie jar!');
    }
    if (!this[sharedAgentsCache]) {
      this[sharedAgentsCache] = new Map();
    }
    
    const key = JSON.stringify({ keepAlive, maxSockets });
    
    if (!this[sharedAgentsCache].has(key)) {
      this[sharedAgentsCache].set(key, {
        http: new HttpCookieAgent({
          cookies: { jar },
          keepAlive,
          maxSockets,
        }),
        https: new HttpsCookieAgent({
          cookies: { jar },
          keepAlive,
          maxSockets,
        }),
      });
    }
    return this[sharedAgentsCache].get(key);
  }
  
  constructor({ proxy = null, jar = null, keepAlive = true, timeout = 60000, maxSockets = 30 } = {}) {
    this.#jar = jar || new tough.CookieJar();
    
    this.keepAlive = !!keepAlive;
    this.proxy = HttpClient.normalizeProxy(proxy);
    this.timeout = timeout;
    this.maxSockets = maxSockets;
  }
  
  #buildClient() {
    const agents = HttpClient.getSharedAgents({ jar: this.#jar, keepAlive: this.keepAlive, maxSockets: this.maxSockets });
    /**
     * Equivalent to { jar: true } in old request...
     * there's no { proxy }, as setProxy() will edit this later, which is the whole point of that setProxy() function.
     * reusability bro.
     */
    const config = {
      jar: this.#jar,
      withCredentials: true, 
      httpAgent: agents.http,
      httpsAgent: agents.https,
      timeout: this.timeout,
      proxy: this.proxy || false,
    }
    if (this.proxy) config.proxy = this.proxy;
    
    this[axiosClient] = axios.create(config);
  }
  
  async #cleanGet(url) {
    try {
      const res = await this[axiosClient].get(url);
      return axiosResponseWrapper(res);
    } catch (error) {
      logger.error("[cleanGet]: An error occurred\n", error);
      throw new Error(error);
    }
  }

  
  async #get({ url, qs = {}, options = {}, ctx = {}, customHeader = {} } = {}) {
    try {
      if (!url || typeof url !== "string") throw new Error(`url must be a string. ${typeof url} was given.`);
      
      const normalizedQs = getType(qs) === "Object"
        ? Object.fromEntries(
            Object.entries(qs).map(([key, value]) => [
              key,
              getType(value) === "Object" ? JSON.stringify(value) : value,
            ])
          )
        : qs;
      
      const requestOptions = {
        headers: getHeaders(url, options, ctx, customHeader),
        params: normalizedQs,
        paramsSerializer: params => qsLib.stringify(params, { arrayFormat: 'repeat' })
      }
    
      const res = await this[axiosClient].get(url, requestOptions);
      return axiosResponseWrapper(res);
    } catch (error) {
      logger.error("[get]: An error occurred\n", error);
      throw new Error(error);
    }
  }

  async #post({ url, form, options = {}, ctx = {}, customHeader = {} } = {}) {
    try {
      const data = qsLib.stringify(form);
      
   	  const requestOptions = {
        headers: getHeaders(url, options, ctx, customHeader),
   	  }

      const res = await this[axiosClient].post(url, data, requestOptions);
      return axiosResponseWrapper(res);
    } catch (error) {
   	  logger.error("[post]: An error occurred\n", error);
   	  throw new Error(error);
    }
  }

  async #postFormData({ url, form, qs = {}, options = {}, ctx = {} } = {}) {
    try {
      if (!url || !form) throw new Error("Please provide a valid URL and FormData object when using postFormData().");
      
      // Build the FormData object if form is not a FormData but a plain object.
      let formData;
      if (form instanceof FormData) {
        formData = form;
      } else {
        formData = new FormData();
        for (const [key, value] of Object.entries(form)) {
          if (value !== undefined && value !== null) {
            formData.append(key, value);
          }
        }
      }
    
      // Normalize query params (stringify nested objects)
      const normalizedQs =
        getType(qs) === "Object"
          ? Object.fromEntries(
              Object.entries(qs).map(([key, value]) => [
                key,
                getType(value) === "Object" ? JSON.stringify(value) : value,
              ])
            )
          : qs;
      
      const requestOptions = {
   	    headers: {
          ...getHeaders(url, options, ctx),
          ...formData.getHeaders() // sets proper Content-Type with boundary
        },
   	    params: normalizedQs,
   	    paramsSerializer: params => qsLib.stringify(params, { arrayFormat: 'repeat' }),
      }
      
      const res = await this[axiosClient].post(url, formData, requestOptions);
      return axiosResponseWrapper(res);
    } catch (error) {
      logger.error("[postFormData]: An error occurred\n", error);
      throw new Error(error);
    }
  }
  
  /**
   * Gets the Axios client for the HTTP client.
   * @returns {Axios} - The Axios client object.
   */
  get axiosClient() {
    if (!this[axiosClient]) throw new Error("Axios client hasn't been initialized yet. use .buildClient() to build the http client.");
    return Object.freeze(this[axiosClient]);
  }

  /**
   * Builds the HTTP client.
   * @returns {HttpClient}
   */
  buildClient() {
    if (!this[axiosClient]) this.#buildClient();
    return this;
  }

  /**
   * Sets the proxy for the HTTP client.
   * @param {object | string} proxyInput - The proxy input to set.
   */
  setProxy(proxyInput) {
    if (!proxyInput) throw new Error("Please provide a valid proxy when using setProxy(), everything will work even without a proxy. But it's recommended to use this if you've got a proxy.");
    const proxy = HttpClient.normalizeProxy(proxyInput);
    this.proxy = proxy;
  }
  
  /**
   * Gets the proxy for the HTTP client.
   * @returns {object | null} - The proxy object or null if no proxy is set.
   */
  getProxy() {
    return this.proxy;
  }
  
  /**
   * Removes the proxy for the HTTP client.
   */
  removeProxy() {
    this.proxy = null;
  }
  
  /**
   * Sets the cookie jar for the HTTP client.
   * @param {object} newJar - The cookie jar to set.
   */
  setJar(newJar) {
    if (!(newJar instanceof tough.CookieJar)) throw new Error("Please pass in a valid tough-cookie CookieJar instance.");
    logger.warn("I hope you know what you're doing before setting a new jar to the axiosClient.");
    this.#jar = newJar;
  }
  
  /**
   * Gets the cookie jar for the HTTP client.
   * @returns {object} - The cookie jar object.
   */
  getJar() {
    return this.#jar;
  }
  
  /**
   * Gets the client for the HTTP client.
   * @returns {import('../types').HttpClient}
   */
  getClient() {
    if (!this[axiosClient]) {
      throw new Error("HttpClient not initialized. Call buildClient() first.");
    }
    
    return Object.freeze({
      cleanGet: (args) => this.#cleanGet(args),
      get: (args) => this.#get(args),
      post: (args) => this.#post(args),
      postFormData: (args) => this.#postFormData(args),
    });
  }
}

// ==============

Object.freeze(HttpClient.prototype);

exports.HttpClient = HttpClient;