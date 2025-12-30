const defaultOptions = {
  selfListen: false,
  selfListenEvent: false,
  listenEvents: true,
  listenTyping: false,
  updatePresence: false,
  forceLogin: false,
  autoMarkDelivery: false,
  autoMarkRead: true,
  autoReconnect: true,
  online: true,
  emitReady: false,
  randomUserAgent: false,
};

function createCoreState(options = defaultOptions) {
  return {
    options,
    ctx: null,
    api: null,
    defaultFuncs: null,

    mqtt: null,
    timers: new Set(),

    closed: false,
  };
}

module.exports = { createCoreState };
