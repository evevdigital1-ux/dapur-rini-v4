'use strict';

const { requestHandler } = require('../server/server');

module.exports = async function handler(req, res) {
  const original = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const rewrittenPath = original.searchParams.get('__path');
  if (rewrittenPath !== null) {
    original.searchParams.delete('__path');
    original.pathname = `/api/${String(rewrittenPath).replace(/^\/+/, '')}`;
    req.url = `${original.pathname}${original.search}`;
  }
  return requestHandler(req, res, { serveStatic: false });
};
