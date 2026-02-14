const bus = require("../core/bus");
const EVENTS = require("../core/events");
const loginFlow = require("../flows/login");

module.exports = function loginAsync(cookie, options) {
  const op = new Operation({ timeout: options.timeout });
  
  const promise = new Promise((resolve, reject) => {
    const ok = (data) => {
      cleanup();
      resolve(data.api);
    };

    const bad = (err) => {
      cleanup();
      reject(err);
    };

    function cleanup() {
      bus.off(EVENTS.SUCCESS, ok);
      bus.off(EVENTS.ERROR, bad);
    }

    bus.once(EVENTS.SUCCESS, ok);
    bus.once(EVENTS.ERROR, bad);

    bus.emit(EVENTS.START, { cookie, options });
    loginFlow({ cookie, options });
  });
  
  promise.cancel = () => op.cancel();
  
  return promise;
};
