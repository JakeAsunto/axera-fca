let start = Date.now();
let stop = false;

let i = 0;
let count = 0;

const { EventBus, EventDomain } = require('../core/bus');

/**
 * @typedef {{ user: EventDomain, auth: EventDomain }} Domains
 */
 
/**
 * Create a new event bus instance.
 * @type {EventBus<Domains> & Domains}
 */
const bus = new EventBus();

bus.createDomain('user');
bus.createDomain('auth');

process.on('SIGBREAK', () => {
  stop = true;
  console.log('Received SIGINT. Performing graceful shutdown...');
  console.log(`(SIGINT) Total events emitted: ${count} in ${Date.now() - start}ms`);
  console.log('Graceful shutdown complete.');
  process.exit();
});

process.on('SIGINT', () => {
  stop = true;
  console.log('Received SIGINT. Performing graceful shutdown...');
  console.log(`(SIGINT) Total events emitted: ${count} in ${Date.now() - start}ms`);
  console.log('Graceful shutdown complete.');
  process.kill(process.pid, 'SIGINT');
});

// bus.onAny(({ name, args }) => {
//   console.log(`[EVENT] ${name}`, ...args);
// });




bus.user.emit("profile", { name: "Jake" });

bus.user.replay("profile", (profile) => {
  if (i % 100000 === 0) console.log("Replayed profile:", profile, i);
});

const controller = new AbortController();

bus.auth.onCancellable("token", controller.signal, (token) => {
  // console.log("Received token:", token);
});

bus.auth.emit("token", "abc123");

const fs = require('fs');
const { Writable } = require('stream');

class LogQueue {
  constructor(threshold = 10000, filePath = 'output.log') {
    this.queue = [];
    this.threshold = threshold;
    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
  }

  log(msg) {
    this.queue.push(msg);
    if (this.queue.length >= this.threshold) {
      this.flush();
    }
  }

  flush() {
    if (this.queue.length === 0) return;
    this.stream.write(this.queue.join('\n') + '\n');
    this.queue = [];
  }

  async close() {
    this.flush();
    return new Promise((resolve) => this.stream.end(resolve));
  }
}

// Generator function for batched event emissions
function* eventGenerator(bus, totalEvents) {
  for (let i = 0; i < totalEvents; i++) {
    yield { type: 'user.profile', data: { name: 'Jake', iteration: i } };
    yield { type: 'auth.token', data: 'abc123' };
  }
}

// Usage
async function runTest() {
  const logger = new LogQueue(10000);
  const bus = new EventBus();
  bus.createDomain('user');
  bus.createDomain('auth');

  let count = 0;
  const start = Date.now();

  for (const event of eventGenerator(bus, 1000000)) {
    if (event.type === 'user.profile') {
      bus.user.emit('profile', event.data);
    } else if (event.type === 'auth.token') {
      bus.auth.emit('token', event.data);
    }
    
    logger.log(`[${event.type}] ${JSON.stringify(event.data)}`);
    count++;
  }

  await logger.close();
  console.log(`Total events: ${count} in ${Date.now() - start}ms`);
}

runTest();

console.log(`Total events emitted: ${count} in ${Date.now() - start}ms`);
