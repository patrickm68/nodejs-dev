'use strict';

var shimmer = require('shimmer');

var requireHook = require('../../../util/requireHook');
var tracingUtil = require('../../tracingUtil');
var constants = require('../../constants');
var cls = require('../../cls');

var isActive = false;
var clientHasBeenInstrumented = false;

exports.init = function() {
  requireHook.onModuleLoad('node-nats-streaming', instrumentNatsStreaming);
};

function instrumentNatsStreaming(natsStreamingModule) {
  shimmer.wrap(natsStreamingModule, 'connect', shimConnect);
}

function shimConnect(originalFunction) {
  return function() {
    var client = originalFunction.apply(this, arguments);
    if (!clientHasBeenInstrumented) {
      shimmer.wrap(client.constructor.prototype, 'publish', shimPublish.bind(null, client.options.url));

      shimmer.wrap(client.constructor.prototype, 'subscribe', shimSubscribe.bind(null, client.options.url));
      clientHasBeenInstrumented = true;
    }
    return client;
  };
}

function shimPublish(natsUrl, originalFunction) {
  return function() {
    if (isActive && cls.isTracing()) {
      var originalArgs = new Array(arguments.length);
      for (var i = 0; i < arguments.length; i++) {
        originalArgs[i] = arguments[i];
      }
      return instrumentedPublish(this, originalFunction, originalArgs, natsUrl);
    }
    return originalFunction.apply(this, arguments);
  };
}

function instrumentedPublish(ctx, originalPublish, originalArgs, natsUrl) {
  var parentSpan = cls.getCurrentSpan();

  if (!cls.isTracing() || !parentSpan || constants.isExitSpan(parentSpan)) {
    return originalPublish.apply(ctx, originalArgs);
  }

  var subject = originalArgs[0];
  var originalCallback = typeof originalArgs[2] === 'function' ? originalArgs[2] : null;

  return cls.ns.runAndReturn(function() {
    var span = cls.startSpan('nats.streaming', constants.EXIT);
    span.ts = Date.now();
    span.stack = tracingUtil.getStackTrace(instrumentedPublish);
    span.data.nats = {
      sort: 'publish',
      address: natsUrl,
      subject: subject
    };

    if (originalCallback) {
      originalArgs[2] = cls.ns.bind(function(err) {
        addErrorToSpan(err, span);
        finishSpan(span);
        originalCallback.apply(this, arguments);
      });
    }

    try {
      return originalPublish.apply(ctx, originalArgs);
    } catch (e) {
      addErrorToSpan(e, span);
      throw e;
    } finally {
      if (!originalCallback) {
        finishSpan(span);
      }
    }
  });
}

function shimSubscribe(natsUrl, originalFunction) {
  return function() {
    var subscription = originalFunction.apply(this, arguments);
    if (subscription) {
      shimmer.wrap(subscription, 'emit', shimSubscriptionEmit.bind(null, natsUrl, arguments[0]));
    }
    return subscription;
  };
}

function shimSubscriptionEmit(natsUrl, subject, originalFunction) {
  return function(type) {
    if (isActive && (type === 'message' || type === 'error')) {
      var originalArgs = new Array(arguments.length);
      for (var i = 0; i < arguments.length; i++) {
        originalArgs[i] = arguments[i];
      }
      return instrumentedEmit(this, originalFunction, originalArgs, natsUrl, subject);
    }
    return originalFunction.apply(this, arguments);
  };
}

function instrumentedEmit(ctx, originalEmit, originalArgs, natsUrl, subject) {
  if (originalArgs[0] === 'message') {
    return captureMessageSpan(ctx, originalEmit, originalArgs, natsUrl, subject);
  } else if (originalArgs[0] === 'error') {
    return captureErrorInCurrentSpan(ctx, originalEmit, originalArgs);
  }
}

function captureMessageSpan(ctx, originalEmit, originalArgs, natsUrl, subject) {
  var span;
  var activeSpan = cls.getCurrentSpan();
  if (activeSpan && activeSpan.n === 'nats' && constants.isEntrySpan(activeSpan)) {
    // Expected case: The raw nats instrumentation kicks in earlier than the nats-streaming instrumentation, so we
    // have already started a raw nats entry span before realizing that it is in fact a nats.streaming entry. We
    // replace this raw nats span with the higher level nats.streaming span.
    span = activeSpan;
    span.n = 'nats.streaming';
  } else if (activeSpan) {
    // Unexpected: There is already an active span, but it is not a raw nats entry span. Abort tracing this
    // nats.streaming entry.
    return originalEmit.apply(ctx, originalArgs);
  }

  return cls.ns.runAndReturn(function() {
    if (!span) {
      // Unexpected: There was no raw nats entry, in fact, there was no active span at all. We can still trace the
      // current nats.streaming entry.
      span = cls.startSpan('nats.streaming', constants.ENTRY);
    }

    span.ts = Date.now();
    span.stack = tracingUtil.getStackTrace(instrumentedEmit);
    // purposefully overwrite data of raw nats entry, if present
    span.data.nats = {
      sort: 'consume',
      address: natsUrl,
      subject: subject
    };

    try {
      return originalEmit.apply(ctx, originalArgs);
      // There is no need to capture synchronous errors here because node-nats-streaming will do that itself and emit an
      // error event, which we capture separately and attach to the current nats.streaming entry span if appropriate.
    } finally {
      setImmediate(function() {
        // Client code is expected to end the span manually, end it automatically in case client code doesn't. Child
        // exit spans won't be captured, but at least the NATS streaming entry span is there.
        finishSpan(span);
      });
    }
  });
}

function captureErrorInCurrentSpan(ctx, originalEmit, originalArgs) {
  var activeSpan = cls.getCurrentSpan();
  if (activeSpan && activeSpan.n === 'nats.streaming') {
    addErrorToSpan(originalArgs[1], activeSpan);
  }
  return originalEmit.apply(ctx, originalArgs);
}

function addErrorToSpan(err, span) {
  if (err) {
    span.ec = 1;

    var errMsg = null;
    if (err.message) {
      errMsg = err.message;
    } else if (typeof err === 'string') {
      errMsg = err;
    }
    if (errMsg && span.data.nats.error) {
      span.data.nats.error += ', ' + errMsg;
    } else if (errMsg) {
      span.data.nats.error = errMsg;
    }
  }
}

function finishSpan(span) {
  span.d = Date.now() - span.ts;
  span.transmit();
}

exports.activate = function() {
  isActive = true;
};

exports.deactivate = function() {
  isActive = false;
};
