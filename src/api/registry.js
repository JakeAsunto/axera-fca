class APIRegistry {
  #map = {};

  constructor(context = null) {
    this.ctx = context; // optional: bind functions to this context
  }

  add(nameOrMap, handler) {
    if (APIRegistry.#assertObjectOrString(nameOrMap) === 'string' && typeof handler === 'function') {
      this.#set(nameOrMap, handler);
      return { addedAPI: true, addedCount: 1 };
    }
    
    if (APIRegistry.#assertObjectOrString(nameOrMap) !== "object") {
      throw new TypeError('[APIRegistry] (add): Invalid API map provided. Provide a key-value object with your API functions as the values.');
    }
    if (handler !== undefined) {
      throw new TypeError('[APIRegistry] (add): object form must not have second parameter');
    }

    for (const [name, fn] of Object.entries(nameOrMap)) {
      if (APIRegistry.#assertObjectOrString(nameOrMap) === 'string' && typeof handler === 'function') {
        this.#set(name, fn);
      }
    }
    
    return { addedAPI: true, addedCount: Object.keys(nameOrMap).length }
  }
  
  get(name) {
    if (typeof name !== 'string') {
      throw new TypeError('[APIRegistry] (get): name must be a string');
    }
    const fn = this.#map[name];
    if (!fn) {
      throw new Error(`API "${name}" is not registered.`);
    }
    return fn;
  }
  
  getCount() {
    return this.#map.size;
  }

  getPublicProxy() {
    return new Proxy({}, { get: (_, key) => this.get(key) });
  }

  #set(name, fn) {
    if (typeof name !== 'string') {
      throw new TypeError('API name must be a string');
    }
    if (typeof fn !== 'function') {
      throw new TypeError(`Handler for "${name}" must be a function`);
    }
    // Optional bind to shared context:
    this.#map[name] = this.ctx ? fn.bind(this.ctx) : fn;
  }

  static #assertObjectOrString(param) {
    const isObj = typeof param === 'object' && param !== null && !Array.isArray(param);
    const isStr = typeof param === 'string';

    if (!isObj && !isStr) {
      throw new TypeError('Parameter must be either a plain object or a string');
    }
    return isObj ? 'object' : 'string';
  }
}