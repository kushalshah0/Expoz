import test from 'node:test'
import assert from 'node:assert/strict'

import { formatLog } from '../logger.js'

test('formats structured log events as JSON', () => {
  const output = JSON.parse(formatLog('info', 'tunnel_connected', { tunnelId: 'demo', port: 3000 })) as Record<string, unknown>

  assert.equal(output.level, 'info')
  assert.equal(output.event, 'tunnel_connected')
  assert.equal(output.tunnelId, 'demo')
  assert.equal(output.port, 3000)
  assert.equal(typeof output.timestamp, 'string')
})
