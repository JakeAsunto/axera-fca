const { EventBus } = require("../core/bus");
const Operation = require("../core/operation");
const LoginFlow = require("../flows/login");

function loginEvents(cookie, options = {}) {
  // Enable observability if specified
  /** @type {EventBus & { login: import("../core/bus").EventDomain }} */
  const bus = new EventBus({ observability: !!options.observability });
  const op = new Operation({ timeout: options.timeout });
  const flow = new LoginFlow({ cookie, options, operation: op });
  
  (async () => {
    try {
      // Initialize login domain
      bus.login = bus.createDomain("login");
      bus.login.emit("start", { options });
      
      flow.setBusNotifier(bus.login);
      const result = await flow.run();
      
      if (result.success) {
        console.log(result);
        bus.login.emit("success", { api: result.api, options });
      } else if (result.error) {
        bus.login.emit("error", { error: result.error, options });
      } else if (result.cancelled) {
        bus.login.emit("cancelled", { reason: result.reason, options });
      }
    } catch (error) {
      bus.login.emit("error", { critical: true, error, options });
      throw error;
    }
  })();

  return {
    bus,
    cancel: () => op.cancel()
  };
};

exports.start = function (cookie, options = {}) {
  try {
    const login = loginEvents(cookie, options);
    return { success: true, api: login.api, error: null, cancelled: this.cancelled };
  } catch (err) {
    return { success: false, error: err, cancelled: this.cancelled };
  }
};
