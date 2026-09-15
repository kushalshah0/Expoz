import WebSocket from 'ws'
import http from 'http'

export function createTunnel({
  port = 3000,
  server = process.env.EXPOZ_SERVER || 'wss://expoz.onrender.com',
  tunnelId = null,
  onUrl = null
} = {}) {
  const ws = new WebSocket(`${server}/register`)

  ws.on('open', () => {
    console.log('Connecting to expoz server...')
    ws.send(JSON.stringify({ type: 'register', tunnelId }))
  })

  ws.on('ping', () => ws.pong())

  ws.on('message', (data) => {
    const msg = JSON.parse(data)

    if (msg.type === 'warn') {
      console.log(`! ${msg.message}`)
    }

    if (msg.type === 'connected') {
      console.log(`\nExposed at: ${msg.url}\n`)
      if (onUrl) onUrl(msg.url)
    }

    if (msg.type === 'request') {
      const options = {
        hostname: 'localhost',
        port,
        path: msg.path || '/',
        method: msg.method,
        headers: {
          ...msg.headers,
          host: `localhost:${port}`
        }
      }

      const req = http.request(options, (res) => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          ws.send(JSON.stringify({
            type: 'response',
            requestId: msg.requestId,
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('base64')
          }))
        })
      })

      req.on('error', () => {
        ws.send(JSON.stringify({
          type: 'response',
          requestId: msg.requestId,
          statusCode: 502,
          headers: { 'content-type': 'application/json' },
          body: Buffer.from(JSON.stringify({
            error: 'Local server unreachable',
            port
          })).toString('base64')
        }))
      })

      if (msg.body) {
        const bodyBuf = Buffer.from(msg.body, 'base64')
        if (bodyBuf.length > 0) req.write(bodyBuf)
      }

      req.end()
    }
  })

  ws.on('close', () => {
    console.log('Disconnected. Reconnecting in 3s...')
    setTimeout(() => createTunnel({ port, server, tunnelId, onUrl }), 3000)
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message)
  })
}