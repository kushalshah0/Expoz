import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SlidingWindowRateLimiter,
  isValidRequestMessage,
  isValidResponseMessage,
  isValidTunnelId,
  parseJsonMessage
} from '../security.js'

test('validates tunnel IDs and rejects unsafe values', () => {
  assert.equal(isValidTunnelId('demo-app_1'), true)
  assert.equal(isValidTunnelId('ab'), false)
  assert.equal(isValidTunnelId('../admin'), false)
  assert.equal(isValidTunnelId('demo app'), false)
})

test('parses malformed WebSocket messages safely', () => {
  assert.deepEqual(parseJsonMessage(Buffer.from('{"type":"register"}')), { type: 'register' })
  assert.equal(parseJsonMessage(Buffer.from('{bad json')), null)
  assert.equal(parseJsonMessage(Buffer.from('[]')), null)
})

test('validates request and response message contracts', () => {
  const request = {
    type: 'request',
    requestId: 'request-1',
    method: 'POST',
    path: '/hooks?x=1',
    headers: {},
    body: Buffer.from('hello').toString('base64')
  }
  const response = {
    type: 'response',
    requestId: 'request-1',
    statusCode: 200,
    headers: { 'content-type': 'text/plain' },
    body: Buffer.from('ok').toString('base64')
  }

  assert.equal(isValidRequestMessage(request), true)
  assert.equal(isValidRequestMessage({ ...request, body: 'not base64!' }), false)
  assert.equal(isValidResponseMessage(response), true)
  assert.equal(isValidResponseMessage({ ...response, statusCode: 99 }), false)
})

test('rate limiter rejects requests after the configured window quota', () => {
  const limiter = new SlidingWindowRateLimiter({ windowMs: 1000, maxRequests: 2 })

  assert.equal(limiter.allow('127.0.0.1', 1000), true)
  assert.equal(limiter.allow('127.0.0.1', 1001), true)
  assert.equal(limiter.allow('127.0.0.1', 1002), false)
  assert.equal(limiter.allow('127.0.0.1', 2001), true)
})
