module.exports = {
  login: {
    callback: require("./adapters/callback"),
    async: require("./adapters/async"),
    events: require("./adapters/events"),
  }
};