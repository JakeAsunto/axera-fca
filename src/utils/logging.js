/*
* [utils/logging.js] - Responsible for the colorful logging to the console. :>
*/
const chalk = require("chalk");
const gradient = require("gradient-string");
// const makeGradient = gradient(["#0061ff", "#681297"]);
const ws = gradient.fruit("Qyber-Fca");

const Logger = {};

Logger.log = (...args) => {
    console.log(ws, chalk.green.bold("[LOG]"), ...args);
}
Logger.error = (...args) => {
    console.error(ws, chalk.red.bold("[ERROR]"), ...args);
}
Logger.warn = (...args) => {
    console.warn(ws, chalk.yellow.bold("[WARNING]"), ...args);
}

module.exports = Logger;