// Preload script to mock 'server-only' and fix CJS hyphenate resolution in standalone Node.js test environments
const path = require('path');
const serverOnlyPath = require.resolve('server-only');
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
};

// Fix for Node 24 CJS resolution of @react-pdf/hyphenate language bundles in tsx/cjs runner
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@react-pdf/hyphenate/')) {
    const lang = request.replace('@react-pdf/hyphenate/', '');
    const directPath = path.resolve(process.cwd(), `node_modules/@react-pdf/hyphenate/lib/${lang}.js`);
    return directPath;
  }
  return origResolve.call(this, request, parent, isMain, options);
};
