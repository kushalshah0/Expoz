import express from 'express'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import https from 'https'
import { nanoid } from 'nanoid'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ noServer: true })

const clients = new Map() // tunnelId -> ws

// Handle WebSocket upgrade only on /register path
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/register') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  } else {
    socket.destroy()
  }
})

wss.on('connection', (ws) => {
  const tunnelId = nanoid(8)
  clients.set(tunnelId, { ws, pending: new Map() })

  ws.send(JSON.stringify({
    type: 'connected',
    tunnelId,
    url: `https://${process.env.APP_DOMAIN || 'your-app.onrender.com'}/t/${tunnelId}`
  }))

  ws.on('message', (data) => {
    const msg = JSON.parse(data)
    if (msg.type === 'response') {
      const client = clients.get(tunnelId)
      const resolve = client?.pending.get(msg.requestId)
      if (resolve) {
        resolve(msg)
        client.pending.delete(msg.requestId)
      }
    }
  })

  ws.on('close', () => clients.delete(tunnelId))
  ws.on('error', () => clients.delete(tunnelId))

  // Keep-alive ping every 25s (Render kills at 30s idle)
  const ping = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping()
    else clearInterval(ping)
  }, 25000)
})

// Proxy tunnel traffic
app.use('/t/:tunnelId', (req, res) => {
  const { tunnelId } = req.params
  const client = clients.get(tunnelId)

  if (!client || client.ws.readyState !== 1) {
    return res.status(502).json({ error: 'No tunnel connected for this ID' })
  }

  const requestId = nanoid()
  const chunks = []

  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    // Strip the /t/:tunnelId prefix before forwarding
    const forwardPath = req.url.replace(`/t/${tunnelId}`, '') || '/'

    client.ws.send(JSON.stringify({
      type: 'request',
      requestId,
      method: req.method,
      path: forwardPath,
      headers: req.headers,
      body: Buffer.concat(chunks).toString('base64')
    }))

    const timeout = setTimeout(() => {
      client.pending.delete(requestId)
      if (!res.headersSent) {
        res.status(504).json({ error: 'Tunnel timeout' })
      }
    }, 30000)

    client.pending.set(requestId, (msg) => {
      clearTimeout(timeout)
      if (res.headersSent) return
      const headers = { ...msg.headers }
      // Remove headers that cause issues
      delete headers['transfer-encoding']
      delete headers['connection']
      res.writeHead(msg.statusCode, headers)
      res.end(Buffer.from(msg.body, 'base64'))
    })
  })
})

app.get('/', (req, res) => res.json({ status: 'tunnel server running' }))

server.listen(process.env.PORT || 3001, () => {
  console.log('Server running')
})

// Keep Render free tier alive (spins down after 15 min of inactivity)
const APP_URL = process.env.APP_URL // set this in Render env vars
if (APP_URL) {
  setInterval(() => {
    https.get(APP_URL).on('error', () => {})
  }, 14 * 60 * 1000) // ping every 14 min
}