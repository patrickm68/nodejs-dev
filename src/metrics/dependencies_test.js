/* eslint-env mocha */

'use strict';

var expect = require('chai').expect;

var dependencies = require('./dependencies');

describe('metrics.dependencies', function() {
  afterEach(function() {
    dependencies.deactivate();
  });

  it('should export a dependencies payload prefix', function() {
    expect(dependencies.payloadPrefix).to.equal('dependencies');
  });

  it('should provide the set of depencies with versions', function(done) {
    dependencies.activate();

    setTimeout(function() {
      // Testing against Mocha dependencies as mocha is the main module when running the tests and dependencies are
      // evaluated as the content of the node_modules directory relative to the main module.
      expect(dependencies.currentPayload.debug).to.equal('3.1.0');
      expect(dependencies.currentPayload['supports-color']).to.equal('5.4.0');
      done();
    }, 500);
  });
});
