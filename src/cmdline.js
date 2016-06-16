'use strict';

var fs = require('fs');

var logger = require('./logger').getLogger('cmdline');

exports.name = undefined;
exports.args = undefined;

try {
  var cmdline = fs.readFileSync(
    '/proc/' + process.pid + '/cmdline',
    {encoding: 'utf8'}
  );
  cmdline = cmdline.split('\u0000');
  if (cmdline.length > 0) {
    exports.name = cmdline[0];
  }
  // There will be one extra (empty) argument in the end due to the
  // trailing \u0000. We are not interested in this one.
  // This behavior is document in `man proc`.
  if (cmdline.length > 2) {
    exports.args = cmdline.slice(1, cmdline.length - 1);
  } else {
    exports.args = [];
  }
} catch (err) {
  if (err.code !== 'ENOENT') {
    logger.warn('cmdline could not be retrieved via proc file. Reason: %s', err.message);
  }
}
