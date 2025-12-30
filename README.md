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

```js
const MyLibrary = (() => {
  const privateMethod = Symbol('privateMethod');
  
  function MyLibrary() {
    this.data = 'Some public data';
  }

  // Private method
  MyLibrary.prototype[privateMethod] = function() {
    console.log('This is a private method!');
  };

  // Public method to access the private method
  MyLibrary.prototype.callPrivateMethod = function() {
    this[privateMethod]();  // Access private method using the symbol
  };

  return MyLibrary;
})();

// Usage
const lib = new MyLibrary();
lib.callPrivateMethod();  // This is a private method!

// The following line would throw an error because privateMethod is not accessible directly
// lib[privateMethod]();  // Error: lib[privateMethod] is not a function
```
```js
const passwordSymbol = Symbol('password');

const userCredentials = {
  username: 'alice',
  [passwordSymbol]: 'superSecretPassword',
};

console.log(userCredentials.username);  // 'alice'

// Trying to access the password using the symbol (external code would need to know this)
console.log(userCredentials[passwordSymbol]);  // 'superSecretPassword'

// But external code can’t get the password through normal means:
console.log(Object.keys(userCredentials));  // [ 'username' ]
```