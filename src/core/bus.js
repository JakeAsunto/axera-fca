/**
 * Copyright 2026 Axera Team. All rights reserved.
 * @author Axera Team (https://github.com/JakeAsunto/axera-fca)
 */
"use strict";
const { EventEmitter } = require("events");

/**
 * @copyright Axera Team (https://github.com/JakeAsunto/axera-fca)
 * @template {Record<string, import('../types').EventDomain>} EventDomains
 * @template {Record<string, import('../types').EventBusOptions>} EventBusSettings
 */
 

 /**
  * The Event Bus where all events of the application flow.
  * @example
  * ```js
  * const bus = new EventBus({ observability: false });
  * bus.on('login.event', () => {});
  * bus.emit('login.event', { user: 'Jake Dev' });
  * 
  * // Create a new domain
  * bus.createDomain('user');
  * bus.user.on('login', () => {});
  * bus.user.emit('login', { user: 'Jake Dev' });
  * 
  * // Turn on observability (for debugging only, can cause performance issues in production)
  * bus.enableObservability();
  * 
  * // Listen for all events
  * bus.onAny((eventPayload) => {
  *   console.log(`Event ${eventPayload.name} emitted with data:`, eventPayload);
  * });
  * 
  * // Turn off observability
  * bus.disableObservability();
  * ```
  * 
  * @author Axera Team (https://github.com/JakeAsunto/axera-fca)
  * @copyright Axera Team
  */
class EventBus extends EventEmitter {
  #history = new Map();
  #eventNames = new Map();
  /** @type {EventDomains} */
  #domains = Object.create(null);
  
  /**
   * Utility function to convert domain and event names to a full event name.
   * @param {string} domainName - The domain name.
   * @param {string} eventName - The event name.
   * @returns {`${string}.${string}`} - The full event name.
   */
  static toFullEventName(domainName, eventName) {
    return `${domainName}.${eventName}`;
  }

  /**
   * Create a new event bus instance.
   * @type {EventBus<EventBusSettings>}
   */
  constructor({ observability = false } = {}) {
    super();
    this.setMaxListeners(50);
    this.observability = observability;
  }
  
  enableObservability() {
    this.observability = true;
  }
  
  disableObservability() {
    this.observability = false;
  }

  /**
   * Listen for any event emitted by the bus.
   * @param {Function} handler - The event handler.
   */
  onAny(handler) {
    super.on('*', handler);
  }

  /**
   * Emit an event with the given name and arguments.
   * @param {symbol} event - The event name.
   * @param {...any} args - The event arguments.
   * @returns {boolean} - Whether the event was handled.
   */
  emit(event, ...args) {
    this.#history.set(event, args);

    try {
      const handled = super.emit(event, ...args);

      // this is observability hook
      if (this.observability) {
        super.emit("*", {
          event,
          name: this.getEventName(event),
          args
        });
      }

      return handled;
    } catch (err) {
      if (event !== "error") {
        super.emit("error", err, {
          event,
          name: this.getEventName(event)
        });
      }
      return false;
    }
  }
  
  /**
   * 
   * @param {symbol} event 
   * @param {AbortSignal} signal 
   * @param {Function} handler 
   * @returns {void}
   */
  onCancellable(event, signal, handler, domainName, eventName) {
    if (!(signal instanceof AbortSignal)) throw new Error('Invalid abort signal passed')
    if (signal.aborted) return;
  
    const wrapped = (...args) => {
      if (!signal.aborted) handler(...args);
    };
  
    this.on(event, wrapped);
  
    signal.addEventListener("abort", () => {
      this.removeListener(event, wrapped);
      this.emit(EventBus.toFullEventName(domainName, 'cancelled'), { event: EventBus.toFullEventName(domainName, eventName), signal, time: Date.now() });
    });
  }
  
  /**
   * 
   * @param {symbol} event 
   * @param {AbortSignal} signal 
   * @param {Function} handler 
   * @returns {void}
   */
  onceCancellable(event, signal, handler, domainName, eventName) {
    if (signal.aborted) return;
  
    const wrapped = (...args) => {
      if (!signal.aborted) handler(...args);
    };
  
    this.once(event, wrapped);
  
    signal.addEventListener("abort", () => {
      const payload = { type: 'cancelled', event: EventBus.toFullEventName(domainName, eventName), signal, time: Date.now() };
      
      signal.removeEventListener()
      this.removeListener(event, wrapped);
      this.emit(EventBus.toFullEventName(domainName, 'cancelled'), payload);
      this.emit('global', payload);
    });
  }
  
  /**
   * 
   * @param {symbol} event 
   * @param {number} timeout 
   * @returns {Promise<any[]>}
   */
  async onceWithTimeout(event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener(event, handler);
        reject(new Error(`Event "${event}" timed out`));
      }, timeout);
  
      const handler = (...args) => {
        clearTimeout(timer);
        resolve(args);
      };
  
      this.once(event, handler);
    });
  }
  
  /**
   * Replay an event with the given handler.
   * @param {symbol} event The event symbol.
   * @param {Function} handler The event handler.
   */
  replay(event, handler) {
    if (this.#history.has(event)) {
      handler(...this.#history.get(event));
    }
    this.on(event, handler);
  }
  
  /**
   * Register an event symbol with a name.
   * @param {symbol} symbol The event symbol.
   * @param {string} name The event name.
   * @returns {symbol} The event symbol.
   */
  registerEvent(symbol, name) {
    this.#eventNames.set(symbol, name);
    return symbol;
  }

  /**
   * Get the name of an event symbol.
   * @param {symbol} event The event symbol.
   * @returns {string} The event name.
   */
  getEventName(event) {
    return this.#eventNames.get(event) || event.toString();
  }
  
  /**
   * Create a new event domain.
   * @param {string} name The domain name.
   * @returns {EventDomain} The new event domain.
   */
  createDomain(name) {
    if (!name || !name.trim() || typeof name !== 'string') throw new Error('Domain name is required');
    
    let domain = this.getDomain(name);
    if (!domain && !this.#domains[name] && !this[name]) {
      this.#domains[name] = this[name] = domain = new EventDomain(this, name);
    }
    return domain;
  }
  
  getDomain(name) {
    if (!name || !name.trim() || typeof name !== 'string') throw new Error('Domain name is required');
    const domain = this[name];
    return domain && domain instanceof EventDomain ? domain : null;
  }
  
  removeDomain(name) {
    if (!name || !name.trim() || typeof name !== 'string') throw new Error('Domain name is required');
    if (this[name] && this[name] instanceof EventDomain) {
      delete this[name];
    }
  }
}

/**
 * A child domain of the Event Bus
 * @author Axera Team (https://github.com/JakeAsunto/axera-fca)
 */
class EventDomain {
  #bus;
  /**
   * A child domain for event handling.
   * @param {EventBus} bus 
   * @param {string} name 
   */
  constructor(bus, name) {
    if (!bus || !(bus instanceof EventBus)) throw new Error('EventBus is required');
    if (!name || !name.trim() || typeof name !== 'string') throw new Error('Domain name is required');
    
    this.#bus = bus;
    this.name = name;
    this.events = Object.create(null); // cache
  }

  /**
   * Register an event handler within this bus domain.
   * @param {string} event 
   * @param {Function} handler 
   */
  on(event, handler) {
    this.#bus.on(this.key(event), handler);
  }

  /**
   * Emit an event within this bus domain.
   * @param {`${eventName}`} event 
   * @param  {...any} args 
   * @returns {boolean}
   */
  emit(event, ...args) {
    return this.#bus.emit(this.key(event), ...args);
  }
  
  /**
   * Register an event handler within this bus domain that will be called only once.
   * @param {string} event 
   * @param {Function} handler 
   */
  once(event, handler) {
    this.#bus.once(this.key(event), handler);
  }
  
  /**
   * Remove an event handler within this bus domain.
   * @param {string} event 
   * @param {Function} handler 
   */
  off(event, handler) {
    this.#bus.off(this.key(event), handler);
  }
  
  /**
   * Replay an event within this bus domain.
   * @param {string} event 
   * @param {Function} handler 
   */
  replay(event, handler) {
    this.#bus.replay(this.key(event), handler);
  }
  
  /**
   * Register an event handler within this bus domain that will be called only once. (with timeout)
   * @param {string} event 
   * @param {number} timeout 
   * @returns {Promise<any[]>}
   */
  async onceWithTimeout(event, timeout) {
    return this.#bus.onceWithTimeout(this.key(event), timeout);
  }
  
  /**
   * Register a cancellable event listener within this bus domain.
   * @param {string} event The event name.
   * @param {AbortSignal} signal The abort signal.
   * @param {Function} handler The event handler.
   */
  onCancellable(event, signal, handler) {
    this.#bus.onCancellable(this.key(event), signal, handler, this.name, event);
  }
  
  /**
   * Register a cancellable event handler within this bus domain that will be called only once.
   * @param {string} event 
   * @param {AbortSignal} signal 
   * @param {Function} handler 
   * @returns {Promise<any[]>}
   */
  onceCancellable(event, signal, handler) {
    return this.#bus.onceCancellable(this.key(event), signal, handler);
  }
  
  /**
   * Get the symbol from event name.
   * @param {string} event The event name.
   * @returns {symbol} The event key.
   */
  key(event) {
    if (!this.events[event]) {
      const fullName = `${this.name}.${event}`;
      const sym = Symbol(fullName);
      this.events[event] = this.#bus.registerEvent(sym, fullName);
    }
    return this.events[event];
  }
}

Object.freeze(EventDomain.prototype);

module.exports = { EventBus, EventDomain };