const ApiRegistry = require("../api/registry");

const apiRegistry = new ApiRegistry();
apiRegistry.add('hi', () => console.log('hi'));

apiRegistry.bulkLoadToRegistry({
  bye: () => console.log('bye'),
  morning: () => console.log('morning')
});

console.log(apiRegistry.expose());
console.log(apiRegistry.isApisFrozen());

console.time('bro')
for (let i = 0; i < 50000; i++) {
  apiRegistry.bulkLoadToRegistry({ [`func${i}`]: () => console.log(`func${i}`) });
}
console.timeEnd('bro')