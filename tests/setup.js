// jsdom doesn't include DOMParser by default
if (typeof globalThis.DOMParser === 'undefined') {
  const { JSDOM } = require('jsdom');
  globalThis.DOMParser = class {
    parseFromString(string, type) {
      return new JSDOM(string, { contentType: type }).window.document;
    }
  };
}
