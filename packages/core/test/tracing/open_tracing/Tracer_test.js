/*
 * (c) Copyright IBM Corp. 2021
 * (c) Copyright Instana Inc. and contributors 2016
 */

'use strict';

const opentracing = require('opentracing');
const Tracer = require('../../../src/tracing/opentracing/Tracer');
const expect = require('chai').expect;

describe('tracing/opentracing/Tracer', () => {
  let tracer;
  let span;

  beforeEach(() => {
    tracer = new Tracer(true);
    span = tracer.startSpan('rpc');
  });

  describe('serialization formats', () => {
    let carrier;

    beforeEach(() => {
      carrier = {};
    });

    describe('inject', () => {
      it('must inject text map context', () => {
        tracer.inject(span, opentracing.FORMAT_TEXT_MAP, carrier);
        expect(carrier).to.deep.equal({
          'x-instana-t': span.span.t,
          'x-instana-s': span.span.s,
          'x-instana-l': '1'
        });
      });

      it('must inject varying log levels', () => {
        span.setTag(opentracing.Tags.SAMPLING_PRIORITY, 0.5);
        tracer.inject(span, opentracing.FORMAT_TEXT_MAP, carrier);
        expect(carrier).to.deep.equal({
          'x-instana-t': span.span.t,
          'x-instana-s': span.span.s,
          'x-instana-l': '0.5'
        });
      });

      it('must respect span hierarchy', () => {
        const child = tracer.startSpan('oauth', {
          childOf: span
        });
        tracer.inject(child, opentracing.FORMAT_TEXT_MAP, carrier);
        expect(carrier).to.deep.equal({
          'x-instana-t': span.span.t,
          'x-instana-s': child.span.s,
          'x-instana-l': '1'
        });
      });

      it('must include baggage items in serialized context', () => {
        span.setBaggageItem('foo', 'bar');
        tracer.inject(span, opentracing.FORMAT_TEXT_MAP, carrier);
        expect(carrier).to.deep.equal({
          'x-instana-t': span.span.t,
          'x-instana-s': span.span.s,
          'x-instana-l': '1',
          'x-instana-b-foo': 'bar'
        });
      });

      it('must url encode values', () => {
        span.setBaggageItem('foo', 'bar & blub');
        tracer.inject(span, opentracing.FORMAT_HTTP_HEADERS, carrier);
        expect(carrier).to.deep.equal({
          'x-instana-t': span.span.t,
          'x-instana-s': span.span.s,
          'x-instana-l': '1',
          'x-instana-b-foo': 'bar%20%26%20blub'
        });
      });

      it('must not fail when requesting unknown or unsupported serialization formats', () => {
        tracer.inject(span, opentracing.FORMAT_BINARY, carrier);
        expect(carrier).to.deep.equal({});
      });
    });

    describe('extract', () => {
      beforeEach(() => {
        carrier = {
          'x-instana-t': 'aTraceId',
          'x-instana-s': 'aSpanId',
          'x-instana-l': '0.5',
          'x-instana-b-foo': 'bar%20%26%20blub'
        };
      });

      it('must extract carrier object into span context and use it for new span', () => {
        const spanContext = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, carrier);
        expect(spanContext.samplingPriority).to.equal(0.5);
        span = tracer.startSpan('oauth', {
          childOf: spanContext
        });
        expect(span.span.t).to.equal('aTraceId');
        expect(span.span.p).to.equal('aSpanId');
        expect(span.getBaggageItem('foo')).to.equal('bar & blub');
      });

      it('must return null for unsupported / unknown serialization formats', () => {
        const spanContext = tracer.extract(opentracing.FORMAT_BINARY, carrier);
        expect(spanContext).to.equal(null);
      });

      it('must translate failed sampling priority parsing to disabled tracing', () => {
        carrier['x-instana-l'] = 'unsupportedValue';
        const spanContext = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, carrier);
        expect(spanContext.samplingPriority).to.equal(0);
      });

      it('must translate partially available parent trace data as unavailable trace data', () => {
        delete carrier['x-instana-t'];
        const spanContext = tracer.extract(opentracing.FORMAT_HTTP_HEADERS, carrier);
        expect(spanContext.t).to.equal(null);
        expect(spanContext.s).to.equal(null);
      });
    });
  });
});
