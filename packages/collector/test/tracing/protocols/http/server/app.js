/* eslint-disable no-console */

'use strict';

require('../../../../../')();

const fs = require('fs');
const path = require('path');
const url = require('url');

const readSymbolProperty = require('../../../../../../core/src/util/readSymbolProperty');
const streamSymbol = 'Symbol(stream)';

const logPrefix = `HTTP: Server (${process.pid}):\t`;
const port = process.env.APP_PORT || 3000;

if (process.env.USE_HTTP2 === 'true' && process.env.USE_HTTPS === 'false') {
  throw new Error('Using the HTTP2 compat API without HTTPS is not supported by this test app.');
}

let server;
if (process.env.USE_HTTPS === 'true') {
  const sslDir = path.join(__dirname, '..', '..', '..', '..', 'apps', 'ssl');
  const createServer =
    process.env.USE_HTTP2 === 'true' ? require('http2').createSecureServer : require('https').createServer;
  server = createServer({
    key: fs.readFileSync(path.join(sslDir, 'key')),
    cert: fs.readFileSync(path.join(sslDir, 'cert'))
  }).listen(port, () => {
    log(`Listening on port ${port} (TLS: true, HTTP2: ${process.env.USE_HTTP2}).`);
  });
} else {
  server = require('http')
    .createServer()
    .listen(port, () => {
      log(`Listening on port ${port} (TLS: false, HTTP2: false).`);
    });
}

server.on('request', (req, res) => {
  if (process.env.WITH_STDOUT) {
    log(`${req.method} ${req.url}`);
  }
  const query = url.parse(req.url, true).query || {};

  if (req.url === '/dont-respond') {
    // Deliberately not sending a response in time so that the request times out client side. This will lead to the
    // following events to be emitted (in that order):
    // - req#aborted
    // - res#close
    setTimeout(() => {
      res.end();
    }, 4000);
    return;
  } else if (req.url === '/destroy-socket') {
    // Deliberately destroying the connection (that is, the underlying socket) server side. This will lead to the
    // following events to be emitted (in that order):
    // - req#aborted
    // - res#close
    req.destroy();
    const underlyingStream = readSymbolProperty(req, streamSymbol);
    if (underlyingStream && !underlyingStream.destroyed) {
      // According to https://nodejs.org/api/http2.html#http2_request_destroy_error the req.destroy() call should also
      // destroy the underlying HTTP 2 stream (if this is HTTP 2 in compat mode) but apparently it does not, so we do it
      // explicitly.
      underlyingStream.destroy();
    }
    return;
  }

  if (query.responseStatus) {
    res.statusCode = parseInt(query.responseStatus || 200, 10);
  }

  const delay = parseInt(query.delay || 0, 10);

  if (query.responseHeader) {
    res.setHeader('X-MY-ENTRY-RESPONSE-HEADER', 'Response Header Value');
  }

  if (delay === 0) {
    endResponse(query, res);
  } else {
    setTimeout(() => {
      endResponse(query, res);
    }, delay);
  }
});

function endResponse(query, res) {
  if (query.writeHead) {
    res.writeHead(200, {
      'X-WRITE-HEAD-RESPONSE-HEADER': 'Write Head Response Header Value'
    });
  }

  // Regularly ending the response will emit the following events:
  // - res#finish
  // - res#close
  res.end();
}

function log() {
  const args = Array.prototype.slice.call(arguments);
  args[0] = logPrefix + args[0];
  console.log.apply(console, args);
}