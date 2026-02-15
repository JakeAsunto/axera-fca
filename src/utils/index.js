// THIS FILE CONTAINS PURE UTILITY FUNCTIONS!

/**
 * Build FB URL
 * @param {string} endpoint - The endpoint to send HTTP request to.
 * @description Syntatic sugar to build FB API URL
 */
exports.fbLink = function fbLink(endpoint) {
  return "https://www.facebook.com" + (endpoint ? '/' + endpoint : '');
}

function getTypeof(param) {
  let trueType;

  const state = {
    isUndefined: typeof param === 'undefined',
    isNull: param === null,
    isNaN: Number.isNaN(param), // NaN is special
    isArray: Array.isArray(param),
    isFunction: typeof param === 'function',
    isBoolean: typeof param === 'boolean',
    isNumber: typeof param === 'number',
    isBigInt: typeof param === 'bigint',
    isString: typeof param === 'string',
    isSymbol: typeof param === 'symbol',
    isObject: typeof param === 'object',
    isDate: param instanceof Date,
    isRegExp: param instanceof RegExp,
    isMap: param instanceof Map,
    isSet: param instanceof Set,
    isWeakMap: param instanceof WeakMap,
    isWeakSet: param instanceof WeakSet,
    isPromise: param instanceof Promise,
    isInfinity: param === Infinity || param === -Infinity
  };

  switch (true) {
    case state.isUndefined:
      trueType = 'undefined';
      break;

    case state.isNull:
      trueType = 'null';
      break;

    case state.isNaN:
      trueType = 'NaN';
      break;

    case state.isArray:
      trueType = 'array';
      break;

    case state.isFunction:
      trueType = 'function';
      break;

    case state.isBoolean:
      trueType = 'boolean';
      break;

    case state.isNumber:
      trueType = 'number';
      break;

    case state.isBigInt:
      trueType = 'bigint';
      break;

    case state.isString:
      trueType = 'string';
      break;

    case state.isSymbol:
      trueType = 'symbol';
      break;

    case state.isObject:
      trueType = 'object';
      break;

    case state.isDate:
      trueType = 'date';
      break;

    case state.isRegExp:
      trueType = 'regexp';
      break;

    case state.isMap:
      trueType = 'map';
      break;

    case state.isSet:
      trueType = 'set';
      break;

    case state.isWeakMap:
      trueType = 'weakmap';
      break;

    case state.isWeakSet:
      trueType = 'weakset';
      break;

    case state.isPromise:
      trueType = 'promise';
      break;

    case state.isInfinity:
      trueType = 'infinity';
      break;

    default:
      trueType = 'unknown';
  }

  return trueType;
}
exports.getTypeof = getTypeof

exports.getStaticAPIs = function getStaticAPIs(apis) {
  if (getTypeof(apis) !== 'object') {
    throw new Error(`getStaticAPIs only accepts an object. Got ${getTypeof(apis)} instead.`);
  }

  // Ensure each property of the object is a function
  for (let key in apis) {
    if (getTypeof(apis[key]) !== 'function') {
      throw new Error(`API '${key}' is not a function. Got ${getTypeof(apis[key])} instead.`);
    }
  }

  // Freeze the object to make it immutable
  return Object.freeze(apis);
}