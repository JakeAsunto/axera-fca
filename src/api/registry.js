/**
 * @typedef {() => Promise<any> | () => {}} Api
 */

class APIRegistry {
  /** @type {Object<string, Api> | null} */
  #ctx = Object.create(null);
  /** @type {Object<string, Api> | null} */
  #apis = Object.create(null);
  #sealed = false;
  #forbidden = new Set(["__proto__", "prototype", "constructor"]);

  constructor(context = null) {
    this.#ctx = context; // optional: bind functions to this context
    Object.freeze(this);
  }
  
  set ctx(value) {
    this.#ctx = value;
  }
  
  /**
   * Purely for backwards compatibility with old fca syntax.
   * @type {null|object}
   */
  get ctx() {
    return Object.freeze(this.#ctx);
  }
  
  /**
   * Get frozen status of the registry.
   * @returns {boolean}
   */
  isApisFrozen() {
    return Object.isFrozen(this.#apis);
  }

  /**
   * Load a collection of functions into the registry.
   * @param {Object<string, Api>[]} functionCollection - An array of objects containing function names as keys and functions as values.
   */
  bulkLoadToRegistry(functionCollection) {
    for (const [name, fn] of Object.entries(functionCollection)) {
      if (typeof fn === 'function') {
        this.add(name, fn);
      }
    }
  }
  
  /**
   * Add an API to the registry.
   * @param {string} name - The name of the API.
   * @param {Api} handler - The API handler function.
   * @returns {void}
   */
  add(name, handler) {
    if (this.#sealed) {
      const error = new Error("API registry is sealed. Cannot add new APIs.");
      error.name = 'RegistrySealedError';
      error.code = 'REGISTRY_SEALED';
      throw error;
    }
    
    if (!name) throw new Error("API name is required");
    
    // bulk add: object
    if (typeof name === "object") {
      for (const key in name) {
        this.add(key, name[key]);
      }
      return;
    }
    
    if (this.#forbidden.has(name)) {
      throw new Error(`API name '${name}' is not allowed`);
    }

    if (name in this.#apis) {
      throw new Error(`API '${name}' already exists`);
    }
    
    if (typeof handler !== "function") {
      throw new Error(`API '${name}' must be a function`);
    }

    this.#apis[name] = handler;
  }

  /**
   * Get an API from the registry.
   * @param {string} name 
   * @returns {Api}
   */
  get(name) {
    return this.#apis[name];
  }
  
  /**
   * Delete an API from the registry.
   * @param {string} name - The name of the API to delete.
   * @throws {Error} If the API name is not allowed or does not exist.
   * @returns {void}
   */
  delete(name) {
    if (!name) throw new Error("API name is required");

    if (this.has(name)) {
      throw new Error(`API name '${name}' is not allowed`);
    }

    if (!this.#apis[name]) {
      throw new Error(`API '${name}' does not exist`);
    }

    delete this.#apis[name];
  }

  /**
   * List all APIs in the registry.
   * @returns {string[]} An array of API names currently registered.
   */
  list() {
    return Object.keys(this.#apis);
  }

  /**
   * Expose the API registry as a frozen object. Contains all APIs added before runtime.
   * @returns {Readonly<{ [name: string]: Api }>} A frozen object containing the API registry.
   */
  expose() {
    return Object.freeze({ ...this.#apis });
  }
  
  /**
   * Seal the API registry at runtime to harden it and prevent misuse.
   */
  seal() {
    this.#sealed = true;
    Object.freeze(this.#apis);
  }
  
  /**
   * Extend the registry with custom APIs.
   * 
   * Note: This method allows extending the registry with custom APIs at runtime. But does not add the api to the registry. You need to use `add()` or `bulkLoadToRegistry()` to add the api to the registry.
   * @example
   * const registry = new ApiRegistry();
   * // core APIs
   * registry.extend(api => {
   *    api.add("setOptions", setOptions);
   *    api.add("getAppState", getAppState);
   * });
   * 
   * // extend with custom APIs
   * registry.extend(api => {
   *    api.add("customApi", customApi);
   * });
   * 
   * @param {Function|Record<string, Function>} fn - A function that takes the exposed API registry and the registry itself as arguments.
   */
  extend(fn) {
    if (this.#sealed) {
      const error = new Error("Cannot extend after seal");
      error.name = 'RegistrySealedError';
      error.code = 'REGISTRY_SEALED';
      throw error;
    }
    if (typeof fn === "function") {
      fn(this.expose(), this);
    } else if (typeof fn === "object") {
      Object.values(fn).forEach(fn => {
        fn(this.expose(), this);
      });
    } else {
      throw new Error("extend() expects a function or an object of functions");
    }
  }
}

Object.freeze(APIRegistry.prototype);
module.exports = APIRegistry;