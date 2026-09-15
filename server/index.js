import express from 'express'
import { WebSocketServer } from 'ws'
import { createServer } from 'http'
import { nanoid } from 'nanoid'
import https from 'https'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ noServer: true })

const BASE_URL = process.env.BASE_URL || 'https://expoz.onrender.com'

const clients = new Map()

// keep render free tier alive
setInterval(() => {
  https.get(BASE_URL).on('error', () => {})
}, 14 * 60 * 1000)

// websocket upgrade only on /register
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
    url: `${BASE_URL}/${tunnelId}`
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

  ws.on('close', () => {
    clients.delete(tunnelId)
    console.log(`Client disconnected: ${tunnelId}`)
  })

  ws.on('error', () => {
    clients.delete(tunnelId)
  })

  const ping = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping()
    else clearInterval(ping)
  }, 25000)

  console.log(`Client connected: ${tunnelId} -> ${BASE_URL}/${tunnelId}`)
})

// reserved routes
app.get('/', (req, res) => res.json({ status: 'expoz server running' }))
app.get('/health', (req, res) => res.json({ ok: true }))

// catch all - treat first segment as tunnel ID
app.use('/:tunnelId', (req, res) => {
  const { tunnelId } = req.params
  const client = clients.get(tunnelId)

  if (!client || client.ws.readyState !== 1) {
    return res.status(502).json({ error: 'No tunnel connected', id: tunnelId })
  }

  const requestId = nanoid()
  const chunks = []

  req.on('data', c => chunks.push(c))
  req.on('end', () => {
    const forwardPath = req.url.replace(`/${tunnelId}`, '') || '/'

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
      delete headers['transfer-encoding']
      delete headers['connection']
      res.writeHead(msg.statusCode, headers)
      res.end(Buffer.from(msg.body, 'base64'))
    })
  })
})

server.listen(process.env.PORT || 3001, () => {
  console.log(`Bore server running on port ${process.env.PORT || 3001}`)
})