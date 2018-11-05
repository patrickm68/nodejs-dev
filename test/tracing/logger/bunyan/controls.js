/* eslint-env mocha */

'use strict';

var spawn = require('child_process').spawn;
var request = require('request-promise');
var path = require('path');

var utils = require('../../../utils');
var config = require('../../../config');
var agentPort = require('../../../apps/agentStubControls').agentPort;
var upstreamPort = require('../../../apps/expressControls').appPort;
var appPort = (exports.appPort = 3215);

var appProcess;

exports.registerTestHooks = function(opts) {
  opts = opts || {};
  var appName = 'app.js';
  if (opts.instanaLoggingMode) {
    switch (opts.instanaLoggingMode) {
      case 'instana-creates-bunyan-logger':
        appName = 'app-instana-creates-bunyan-logger.js';
        break;
      case 'instana-receives-bunyan-logger':
        appName = 'app-instana-receives-bunyan-logger.js';
        break;
      case 'instana-receives-non-bunyan-logger':
        appName = 'app-instana-receives-non-bunyan-logger.js';
        break;
      default:
        throw new Error('Unknown instanaLoggingMode: ' + opts.instanaLoggingMode);
    }
  }
  beforeEach(function() {
    var env = Object.create(process.env);
    env.AGENT_PORT = agentPort;
    env.APP_PORT = appPort;
    env.UPSTREAM_PORT = upstreamPort;
    env.STACK_TRACE_LENGTH = opts.stackTraceLength || 0;
    env.TRACING_ENABLED = opts.enableTracing !== false;

    appProcess = spawn('node', [path.join(__dirname, appName)], {
      stdio: config.getAppStdio(),
      env: env
    });

    return waitUntilServerIsUp();
  });

  afterEach(function() {
    appProcess.kill();
  });
};

function waitUntilServerIsUp() {
  return utils.retry(function() {
    return request({
      method: 'GET',
      url: 'http://127.0.0.1:' + appPort,
      headers: {
        'X-INSTANA-L': '0'
      }
    });
  });
}

exports.getPid = function() {
  return appProcess.pid;
};

exports.trigger = function(level) {
  return request('http://127.0.0.1:' + appPort + '/' + level);
};
