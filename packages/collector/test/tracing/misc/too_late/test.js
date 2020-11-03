'use strict';

const {
  expect,
  assert: { fail }
} = require('chai');
const semver = require('semver');

const constants = require('@instana/core').tracing.constants;
const supportedVersion = require('@instana/core').tracing.supportedVersion;
const config = require('../../../../../core/test/config');
const testUtils = require('../../../../../core/test/test_util');
const ProcessControls = require('../../../test_util/ProcessControls');

let agentControls;

describe('tracing/too late', function() {
  if (!supportedVersion(process.versions.node) || semver.lt(process.versions.node, '8.0.0')) {
    return;
  }

  agentControls = require('../../../apps/agentStubControls');

  this.timeout(config.getTestTimeout());

  agentControls.registerTestHooks();

  [
    '@elastic/elasticsearch',
    '@google-cloud/pubsub',
    '@google-cloud/storage',
    '@hapi/call',
    'amqplib',
    'aws-sdk',
    'bluebird',
    'elasticsearch',
    'express',
    'fastify',
    'graphql',
    'graphql-subscriptions',
    'grpc',
    'ioredis',
    'kafka-node',
    'kafkajs',
    'koa-router',
    'log4js',
    'mongodb',
    'mssql',
    'mysql',
    'mysql2',
    'mysql2',
    'nats',
    'node-nats-streaming',
    'pg',
    'pg-native',
    'pino',
    'redis',
    'request',
    'superagent',
    'winston'
  ].forEach(moduleName => registerTooLateTest.bind(this)(moduleName));

  function registerTooLateTest(moduleName) {
    describe(`@instana/collector is initialized too late (${moduleName})`, function() {
      const controls = new ProcessControls({
        dirname: __dirname,
        agentControls,
        env: {
          REQUIRE_BEFORE_COLLECTOR: moduleName
        }
      }).registerTestHooks();

      it(`should warn when module ${moduleName} has been require before @instana/collector`, () =>
        controls
          .sendRequest({
            path: '/'
          })
          .then(() =>
            testUtils.retry(() =>
              Promise.all([
                agentControls.getSpans(),
                agentControls.getMonitoringEvents(),
                agentControls.getAllMetrics(controls.getPid())
              ]).then(([spans, monitoringEvents, metrics]) => {
                // expect HTTP entry to be captured
                testUtils.expectAtLeastOneMatching(spans, span => {
                  expect(span.n).to.equal('node.http.server');
                  expect(span.k).to.equal(constants.ENTRY);
                  expect(span.async).to.not.exist;
                  expect(span.error).to.not.exist;
                  expect(span.ec).to.equal(0);
                  expect(span.p).to.not.exist;
                  expect(span.data.http.method).to.equal('GET');
                  expect(span.data.http.url).to.equal('/');
                });

                // expect HTTP exit to not be captured
                const httpExits = testUtils.getSpansByName(spans, 'node.http.client');
                expect(httpExits).to.have.lengthOf(0);

                // expect the initialized-too-late monitoring event to have been fired
                expect(monitoringEvents).to.deep.include(
                  {
                    plugin: 'com.instana.forge.infrastructure.runtime.nodejs.NodeJsRuntimePlatform',
                    pid: controls.getPid(),
                    code: 'nodejs_collector_initialized_too_late',
                    duration: 660000,
                    category: 'TRACER'
                  },
                  JSON.stringify(monitoringEvents)
                );

                // expect initTooLate to have been recorded via snapshot data too (until that mechanism is removed)
                let initTooLateFound = false;
                metrics.forEach(m => {
                  if (m && m.data) {
                    if (m.data.initTooLate === true) {
                      initTooLateFound = true;
                    } else if (m.data.initTooLate !== undefined) {
                      fail(
                        `Found invalid value (${m.data.initTooLate}, type: ${typeof m.data
                          .initTooLate}) for initTooLate metric, should be either undefined or true.`
                      );
                    }
                  }
                });
                expect(initTooLateFound).to.be.true;
              })
            )
          ));
    });
  }

  describe('@instana/collector is initialized properly', () => {
    const controls = new ProcessControls({
      dirname: __dirname,
      agentControls
    }).registerTestHooks();

    it('should not warn about being initialized too late', () =>
      controls
        .sendRequest({
          path: '/'
        })
        .then(() =>
          testUtils.retry(() =>
            Promise.all([
              agentControls.getSpans(),
              agentControls.getMonitoringEvents(),
              agentControls.getAllMetrics(controls.getPid())
            ]).then(([spans, monitoringEvents, metrics]) => {
              const httpEntry = testUtils.expectAtLeastOneMatching(spans, span => {
                expect(span.n).to.equal('node.http.server');
                expect(span.k).to.equal(constants.ENTRY);
                expect(span.p).to.not.exist;
                expect(span.data.http.method).to.equal('GET');
                expect(span.data.http.url).to.equal('/');
              });

              // expect HTTP exit to have been captured
              testUtils.expectAtLeastOneMatching(spans, span => {
                expect(span.n).to.equal('node.http.client');
                expect(span.k).to.equal(constants.EXIT);
                expect(span.p).to.equal(httpEntry.s);
                expect(span.data.http.method).to.equal('GET');
                expect(span.data.http.url).to.match(/http:\/\/127\.0\.0\.1:[0-9]+/);
              });

              // expect initTooLate monitoring event to NOT have been fired
              expect(monitoringEvents).to.be.empty;

              // expect initTooLate to NOT have been recorded in the snapshot data
              let initTooLateFound = false;
              metrics.forEach(m => {
                if (m && m.data) {
                  if (m.data.initTooLate === true) {
                    initTooLateFound = true;
                  } else if (m.data.initTooLate !== undefined) {
                    fail(
                      `Found invalid value (${m.data.initTooLate}, type: ${typeof m.data
                        .initTooLate}) for initTooLate metric, should be either undefined or true.`
                    );
                  }
                }
              });
              expect(initTooLateFound).to.be.false;
            })
          )
        ));
  });
});
