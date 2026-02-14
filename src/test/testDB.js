const repl = require('node:repl');

// Start the REPL command prompt
const local = repl.start('$ ');

// Optional: Display a message on exit
local.on('exit', () => {
  console.log('Exiting REPL');
  process.exit();
});
