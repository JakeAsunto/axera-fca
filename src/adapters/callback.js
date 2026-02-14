// adapters/callback.js
const bus = require("../core/bus");
const EVENTS = require("../core/events");
const Operation = require("../core/operation")
const loginFlow = require("../flows/login");

module.exports = function loginCallback(cookie, options, cb) {
  try {
    const op = new Operation({ timeout: options.timeout });
  
    function done(evt, handler) {
      return (payload) => {
        if (payload.op !== op) return;
        cleanup();
        handler(evt, payload);
      };
    }
  
    function cleanup() {
      bus.off(EVENTS.SUCCESS, success);
      bus.off(EVENTS.ERROR, error);
      bus.off(EVENTS.CANCELLED, cancelled);
    }
  
    // p = promise containing data to return
    const success = done(EVENTS.SUCCESS, p => cb(EVENTS.SUCCESS, p.api));
    const error = done(EVENTS.ERROR, p => cb(EVENTS.ERROR, p.error));
    const cancelled = done(EVENTS.CANCELLED, p => cb(EVENTS.CANCELLED, p.reason));
  
    bus.once(EVENTS.SUCCESS, success);
    bus.once(EVENTS.CANCELLED, cancelled);
    bus.on(EVENTS.ERROR, error);
    
    bus.emit(EVENTS.START, { cookie, options, op });
  
    loginFlow({ cookie, options, op });
  
    return {
      cancel: () => op.cancel()
    };
  } catch (error) {
    bus.on(EVENTS.ERROR, () => cb(EVENTS.ERROR, error));
    cb(EVENTS.ERROR, error);
  }
};