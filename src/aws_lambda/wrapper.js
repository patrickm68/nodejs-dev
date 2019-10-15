'use strict';

const instanaCore = require('@instana/core');

const consoleLogger = require('../util/console_logger');
const backendConnector = require('../util/backend_connector');
const identityProvider = require('./identity_provider');
const triggers = require('./triggers');

const { metrics, tracing } = instanaCore;
const { constants, spanBuffer } = tracing;
let logger = consoleLogger;

// Initialize instrumentations early to allow for require statements after our package has been required but before the
// actual instana.wrap(...) call.
instanaCore.preInit();

/**
 * Wraps an AWS Lambda handler so that metrics and traces are reported to Instana. This function will figure out if the
 * Lambda handler uses the callback style or promise/async function style by inspecting the number of function arguments
 * the function receives.
 */
exports.wrap = function wrap(config, originalHandler) {
  /* eslint-disable no-unused-vars */
  if (arguments.length === 1) {
    originalHandler = config;
    config = null;
  }

  // Apparently the AWS Lambda Node.js runtime does not inspect the handlers signature for the number of arguments it
  // accepts. But to be extra safe, we strive to return a function with the same number of arguments anyway.
  switch (originalHandler.length) {
    case 0:
      return function handler0() {
        return shimmedHandler(originalHandler, this, arguments, config);
      };
    case 1:
      return function handler1(event) {
        return shimmedHandler(originalHandler, this, arguments, config);
      };
    case 2:
      return function handler2(event, context) {
        return shimmedHandler(originalHandler, this, arguments, config);
      };
    default:
      return function handler3(event, context, callback) {
        return shimmedHandler(originalHandler, this, arguments, config);
      };
  }
};

function shimmedHandler(originalHandler, originalThis, originalArgs, config) {
  const event = originalArgs[0];
  const context = originalArgs[1];
  const lambdaCallback = originalArgs[2];

  const tracingHeaders = triggers.readTracingHeaders(event);
  const incomingTraceId = tracingHeaders.t;
  const incomingParentSpanId = tracingHeaders.s;
  const tracingSuppressed = tracingHeaders.l === '0';

  init(event, context, config);

  // The AWS lambda runtime does not seem to inspect the number of arguments the handler function expects. Instead, it
  // always call the handler with three arguments (event, context, callback), no matter if the handler will use the
  // callback or not. If the handler returns a promise, the runtime uses the that promise's value when it resolves as
  // the result. If the handler calls the callback, that value is used as the result. If the handler does both
  // (return a promise and resolve it _and_ call the callback), it depends on the timing. Whichever happens first
  // dictates the result of the lambda invocation, the later result is ignored. To match this behaviour, we always
  // wrap the given callback _and_ return an instrumented promise.
  let handlerHasFinished = false;
  return tracing.getCls().ns.runPromiseOrRunAndReturn(() => {
    let entrySpan;
    if (tracingSuppressed) {
      tracing.getCls().setTracingLevel('0');
    } else {
      entrySpan = tracing
        .getCls()
        .startSpan('aws.lambda.entry', constants.ENTRY, incomingTraceId, incomingParentSpanId);
      entrySpan.data = {
        lambda: {
          arn: `${context.invokedFunctionArn}:${context.functionVersion}`,
          runtime: 'nodejs',
          functionName: context.functionName,
          functionVersion: context.functionVersion
        }
      };
      triggers.enrichSpanWithTriggerData(event, entrySpan);
    }

    originalArgs[2] = function wrapper(originalError, originalResult) {
      if (handlerHasFinished) {
        return;
      }
      handlerHasFinished = true;
      postHandler(entrySpan, originalError, originalResult, () => {
        lambdaCallback(originalError, originalResult);
      });
    };

    const handlerPromise = originalHandler.apply(originalThis, originalArgs);
    if (handlerPromise && typeof handlerPromise.then === 'function') {
      return handlerPromise.then(
        value => {
          if (handlerHasFinished) {
            return Promise.resolve(value);
          }
          handlerHasFinished = true;
          return postPromise(context, entrySpan, null, value);
        },
        error => {
          if (handlerHasFinished) {
            return Promise.reject(error);
          }
          handlerHasFinished = true;
          return postPromise(context, entrySpan, error);
        }
      );
    } else {
      return handlerPromise;
    }
  });
}

/**
 * Initialize the wrapper.
 */
function init(event, context, config) {
  /* eslint-disable dot-notation */
  config = config || {};

  if (config.logger) {
    logger = config.logger;
  } else if (config.level || process.env['INSTANA_LOG_LEVEL']) {
    logger.setLevel(config.level || process.env['INSTANA_LOG_LEVEL']);
  }
  identityProvider.init(context);
  backendConnector.init(identityProvider, logger);

  instanaCore.init(config, backendConnector, identityProvider);

  metrics.init(config);
  metrics.activate();
  tracing.activate();
}

/**
 * Code to be executed after the promise returned by the original handler has completed.
 */
function postPromise(context, entrySpan, error, value) {
  return new Promise((resolve, reject) => {
    postHandler(entrySpan, error, value, () => {
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    });
  });
}

function postHandler(entrySpan, error, result, callback) {
  // entrySpan is null when tracing is suppressed due to X-Instana-L
  if (entrySpan) {
    if (error) {
      entrySpan.ec = 1;
      entrySpan.data.lambda.error = error.message ? error.message : error.toString();
    }
    // capture HTTP errors
    if (result && typeof result === 'object' && result.statusCode) {
      if (typeof result.statusCode === 'number') {
        entrySpan.data.http = entrySpan.data.http || {};
        entrySpan.data.http.status = result.statusCode;
        if (result.statusCode >= 500) {
          entrySpan.ec = entrySpan.ec ? entrySpan.ec + 1 : 1;
          entrySpan.data.lambda.error = entrySpan.data.lambda.error || `HTTP status ${result.statusCode}`;
        }
      } else if (typeof result.statusCode === 'string' && /^\d\d\d$/.test(result.statusCode)) {
        entrySpan.data.http = entrySpan.data.http || {};
        entrySpan.data.http.status = parseInt(result.statusCode, 10);
        if (entrySpan.data.http.status >= 500) {
          entrySpan.ec = entrySpan.ec ? entrySpan.ec + 1 : 1;
          entrySpan.data.lambda.error = entrySpan.data.lambda.error || `HTTP status ${result.statusCode}`;
        }
      }
    }
    entrySpan.error = entrySpan.ec > 0;
    entrySpan.d = Date.now() - entrySpan.ts;

    entrySpan.transmit();
  }

  const spans = spanBuffer.getAndResetSpans();

  const metricsData = metrics.gatherData();

  // Quick fix for metrics name collision between in-process collector and infra monitoring. Needs to be fixed in
  // @instana/core eventually by being able to select individual metrics.
  renameMetric(metricsData, 'name', 'npmPackageName');
  renameMetric(metricsData, 'version', 'npmPackageVersion');
  renameMetric(metricsData, 'description', 'npmPackageDescription');

  const metricsPayload = {
    plugins: [{ name: 'com.instana.plugin.aws.lambda', entityId: identityProvider.getEntityId(), data: metricsData }]
  };

  backendConnector.sendBundle({ spans, metrics: metricsPayload }, err => {
    if (err) {
      // We intentionally do not propagate the error from the backend request - the customer's lambda needs to finish
      // successfully, no matter if we have been able to report metrics and spans.
      logger.warn('Could not send data to backend.', err.message);
      logger.debug('Could not send data to backend.', err);
    } else {
      logger.debug('Data has been sent to backend.');
    }
    callback();
  });
}

function renameMetric(metricsData, oldKey, newKey) {
  if (metricsData[oldKey] != null) {
    metricsData[newKey] = metricsData[oldKey];
    delete metricsData[oldKey];
  }
}
