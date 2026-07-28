// jsdom doesn't include DOMParser by default
if (typeof globalThis.DOMParser === 'undefined') {
  const { JSDOM } = require('jsdom');
  globalThis.DOMParser = class {
    parseFromString(string, type) {
      return new JSDOM(string, { contentType: type }).window.document;
    }
  };
}

// Polyfill URL.createObjectURL and URL.revokeObjectURL for download/export tests
if (typeof globalThis.URL.createObjectURL === 'undefined') {
  globalThis.URL.createObjectURL = () => 'blob:mock-url';
  globalThis.URL.revokeObjectURL = () => {};
}

