exports.parseCookies = function parseCookies(input) {
  if (Array.isArray(input) && input.length > 0) {
    return input.map(c => {
      let name = c.name;
      let key = c.key;
      let value = c.value;
      
      return `${name || key}=${value}`;
    });
  } else if (typeof input === 'string') {
    return input.split(';');
  }
  return undefined;
}