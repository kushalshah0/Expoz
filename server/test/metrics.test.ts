import test from 'node:test'
import assert from 'node:assert/strict'

import { Metrics } from '../metrics.js'

test('tracks tunnel, request, response, error, and byte metrics', () => {
  const metrics = new Metrics()

  metrics.tunnelConnected()
  metrics.requestStarted()
  metrics.requestBytesReceived(128)
  metrics.responseBytesSent(256)
  metrics.responseCompleted(201)
  metrics.responseCompleted(502)
  metrics.tunnelDisconnected()

  assert.deepEqual(metrics.snapshot(), {
    activeTunnels: 0,
    requestsTotal: 1,
    responsesTotal: 2,
    errorsTotal: 1,
    requestBytes: 128,
    responseBytes: 256
  })
})
