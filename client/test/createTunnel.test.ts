import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocketServer } from 'ws'

import { createTunnel } from '../index.js'
import { parseCliArgs } from '../cli.js'
import { isValidRequestMessage } from '../protocol.js'

function createTunnelServer(): Promise<{ httpServer: http.Server, port: number }> {
  return new Promise((resolve) => {
    const httpServer = http.createServer()
    const wss = new WebSocketServer({ noServer: true })

    httpServer.on('upgrade', (req, socket, head) => {
      if (req.url === '/register') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req)
        })
      } else {
        socket.destroy()
      }
    })

    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'register') {
          ws.send(JSON.stringify({
            type: 'connected',
            tunnelId: msg.tunnelId || 'demo',
            url: `https://example.com/${msg.tunnelId || 'demo'}`
          }))
        }
      })
    })

    httpServer.listen(0, '127.0.0.1', () => {
      const address = httpServer.address() as AddressInfo
      resolve({ httpServer, port: address.port })
    })
  })
}

test('createTunnel returns a stop handle and can clean up the socket', async () => {
  const { httpServer, port } = await createTunnelServer()

  let onUrlCalled = false
  const tunnel = createTunnel({
    port: 3000,
    server: `ws://127.0.0.1:${port}`,
    tunnelId: 'demo',
    onUrl: () => {
      onUrlCalled = true
    }
  })

  assert.ok(tunnel && typeof tunnel.stop === 'function')

  await new Promise((resolve) => setTimeout(resolve, 150))
  assert.equal(onUrlCalled, true)

  tunnel.stop()
  await new Promise((resolve) => setTimeout(resolve, 150))

  httpServer.close()
})

test('cli parser accepts port, id, and server flags', () => {
  const parsed = parseCliArgs(['--port', '4000', '--id', 'demo-app', '--server', 'ws://example.test'])

  assert.deepEqual(parsed, {
    port: 4000,
    tunnelId: 'demo-app',
    server: 'ws://example.test'
  })
})

test('cli parser rejects ports outside the valid range', () => {
  assert.equal(parseCliArgs(['--port', '70000']).error, 'Port must be between 1 and 65535')
})

test('request protocol validation rejects malformed payloads', () => {
  const request = {
    type: 'request' as const,
    requestId: 'request-1',
    method: 'GET',
    path: '/',
    headers: {},
    body: ''
  }

  assert.equal(isValidRequestMessage(request), true)
  assert.equal(isValidRequestMessage({ ...request, method: 'get' }), false)
  assert.equal(isValidRequestMessage({ ...request, body: 'invalid!' }), false)
})
