# 🧱 Axera - FCA

## What is this?

> This is the incoming FB Chat API published by the Axera Team.

## What to expect?

> This source code is experimental and is not yet complete but shows part of the structure of the incoming FCA.

```md
1. state.js        ← owns globals
2. core.js         ← computes decisions
3. effects.js      ← does IO
4. adapters.js     ← callback / promise
```

# Event-Driven
```js
// sample
const login = require('axera-fca').events;

// attach login listener
login.on("login:success", ({ api }) => {
  console.log("Ready");
  
  //extend bot logic from here
});

// start login process
login.start(cookie);
```
# Async/Await
```js
// sample 2
const login = require('axera-fca').async;

async function main() {
  const api = await login.start(cookie);
  //extend bot logic from here
}
```
# Callback
```js
// sample 3
const login = require('axera-fca').callback;

login.start(cookie, async function callback(error, api) {
  // extend bot logic from here
});
```
