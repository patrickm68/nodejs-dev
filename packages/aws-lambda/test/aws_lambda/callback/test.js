/* eslint-env mocha */

'use strict';

const path = require('path');

const commonTests = require('../common/tests_common.js');

describe('aws/lambda/callback', function() {
  commonTests.registerTests.bind(this)(path.join(__dirname, './lambda'));
});
