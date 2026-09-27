import express from 'express'
import { WebSocketServer } from 'ws'
import type { WebSocket, RawData } from 'ws'
import { createServer } from 'http'
import { nanoid } from 'nanoid'
import https from 'https'
import type { Request, Response } from 'express'
import type { RegisterMessage, ResponseMessage } from './protocol.js'
import { Metrics } from './metrics.js'
import {
  isValidResponseChunkMessage,
  isValidResponseEndMessage,
  isValidResponseMessage,
  isValidResponseStartMessage,
  isValidTunnelId,
  parseJsonMessage,
  SlidingWindowRateLimiter
} from './security.js'

interface PendingResponse {
  response: Response
  timeout: NodeJS.Timeout
  responseStarted: boolean
}

interface TunnelClient {
  ws: WebSocket
  pending: Map<string, PendingResponse>
}

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ noServer: true })

const BASE_URL = process.env.BASE_URL || 'https://expoz.onrender.com'

const keepAlive = setInterval(() => {
  https.get(BASE_URL).on('error', () => {})
}, 14 * 60 * 1000)
keepAlive.unref()

const clients = new Map<string, TunnelClient>()
const metrics = new Metrics()
const requestRateLimiter = new SlidingWindowRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 60
})
const rateLimitCleanup = setInterval(() => requestRateLimiter.cleanup(), 60_000)
rateLimitCleanup.unref()

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

wss.on('connection', (ws: WebSocket) => {
  let tunnelId: string | null = null

  const ping = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.ping()
    else clearInterval(ping)
  }, 25000)

  ws.once('message', (data: RawData) => {
    const msg = parseJsonMessage(rawDataToBuffer(data)) as RegisterMessage | null

    if (msg?.type === 'register') {
      if (msg.tunnelId && isValidTunnelId(msg.tunnelId) && !clients.has(msg.tunnelId)) {
        tunnelId = msg.tunnelId
      } else {
        if (msg.tunnelId) {
          ws.send(JSON.stringify({
            type: 'warn',
            message: `ID "${msg.tunnelId}" is taken, assigned a random one`
          }))
        }
        tunnelId = nanoid(8)
      }

      clients.set(tunnelId, { ws, pending: new Map() })
        metrics.tunnelConnected()

      ws.send(JSON.stringify({
        type: 'connected',
        tunnelId,
        url: `${BASE_URL}/${tunnelId}`
      }))

      console.log(`Client connected: ${tunnelId} -> ${BASE_URL}/${tunnelId}`)

      ws.on('message', (data: RawData) => {
        const msg = parseJsonMessage(rawDataToBuffer(data))
        if (tunnelId && isValidResponseMessage(msg)) {
          const client = clients.get(tunnelId)
          const pending = client?.pending.get(msg.requestId)
          if (pending) {
            clearTimeout(pending.timeout)
            if (!pending.response.headersSent) {
              const headers = { ...msg.headers }
              delete headers['transfer-encoding']
              delete headers['connection']
              pending.response.writeHead(msg.statusCode, headers)
              pending.response.end(Buffer.from(msg.body, 'base64'))
              metrics.responseBytesSent(Buffer.byteLength(msg.body, 'base64'))
              metrics.responseCompleted(msg.statusCode)
            }
            client?.pending.delete(msg.requestId)
          }
        } else if (tunnelId && isValidResponseStartMessage(msg)) {
          const pending = clients.get(tunnelId)?.pending.get(msg.requestId)
          if (pending && !pending.responseStarted) {
            const headers = { ...msg.headers }
            delete headers['transfer-encoding']
            delete headers['connection']
            pending.response.writeHead(msg.statusCode, headers)
            pending.responseStarted = true
          }
        } else if (tunnelId && isValidResponseChunkMessage(msg)) {
          const pending = clients.get(tunnelId)?.pending.get(msg.requestId)
          if (pending?.responseStarted && !pending.response.writableEnded) {
            pending.response.write(Buffer.from(msg.body, 'base64'))
            metrics.responseBytesSent(Buffer.byteLength(msg.body, 'base64'))
          }
        } else if (tunnelId && isValidResponseEndMessage(msg)) {
          const client = clients.get(tunnelId)
          const pending = client?.pending.get(msg.requestId)
          if (pending) {
            clearTimeout(pending.timeout)
            if (!pending.response.writableEnded) pending.response.end()
            metrics.responseCompleted(pending.response.statusCode || 200)
            client?.pending.delete(msg.requestId)
          }
        } else {
          ws.close(1008, 'Invalid response message')
        }
      })
    } else {
      ws.close(1008, 'Invalid registration message')
    }
  })

  ws.on('close', () => {
    if (tunnelId) {
      const client = clients.get(tunnelId)
      if (client?.ws === ws) {
        for (const pending of client.pending.values()) clearTimeout(pending.timeout)
        clients.delete(tunnelId)
        metrics.tunnelDisconnected()
      }
      console.log(`Client disconnected: ${tunnelId}`)
    }
    clearInterval(ping)
  })

  ws.on('error', () => {
    if (tunnelId && clients.get(tunnelId)?.ws === ws) {
      clients.delete(tunnelId)
      metrics.tunnelDisconnected()
    }
    clearInterval(ping)
  })
})

// reserved routes
app.get('/', (req, res) => res.json({ status: 'expoz server running' }))
app.get('/health', (req, res) => res.json({ ok: true }))
app.get('/status', (req, res) => res.json(metrics.snapshot()))

// catch all - treat first segment as tunnel ID
app.use('/:tunnelId', (req: Request, res: Response) => {
  const tunnelId = Array.isArray(req.params.tunnelId) ? req.params.tunnelId[0] : req.params.tunnelId
  const client = clients.get(tunnelId)

  if (!requestRateLimiter.allow(req.ip || req.socket.remoteAddress || 'unknown')) {
    metrics.error()
    return res.status(429).json({ error: 'Too many requests' })
  }

  if (!client || client.ws.readyState !== 1) {
    metrics.error()
    return res.status(502).json({ error: 'No tunnel connected', id: tunnelId })
  }

  metrics.requestStarted()
  let bodyLength = 0
  const maxBodyBytes = Number(process.env.MAX_BODY_BYTES) || 10 * 1024 * 1024
  const requestId = nanoid()
  const timeout = setTimeout(() => {
    client.pending.delete(requestId)
    if (!res.headersSent) res.status(504).json({ error: 'Tunnel timeout' })
  }, 30000)
  client.pending.set(requestId, { response: res, timeout, responseStarted: false })

  client.ws.send(JSON.stringify({
    type: 'request_start',
    requestId,
    method: req.method,
    path: req.url.replace(`/${tunnelId}`, '') || '/',
    headers: req.headers
  }))

  req.on('data', (chunk: Buffer) => {
    bodyLength += chunk.length
    metrics.requestBytesReceived(chunk.length)
    if (bodyLength > maxBodyBytes) {
      req.destroy()
      if (!res.headersSent) res.status(413).json({ error: 'Request body too large' })
      metrics.error()
      return
    }
    req.pause()
    client.ws.send(JSON.stringify({
      type: 'request_chunk',
      requestId,
      body: chunk.toString('base64')
    }), () => req.resume())
  })
  req.on('end', () => {
    if (bodyLength > maxBodyBytes || res.headersSent) return
    client.ws.send(JSON.stringify({ type: 'request_end', requestId }))
  })
})

server.listen(process.env.PORT || 3001, () => {
  console.log(`Expoz server running on port ${process.env.PORT || 3001}`)
})

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down...`)
  clearInterval(keepAlive)
  clearInterval(rateLimitCleanup)

  for (const client of clients.values()) {
    for (const pending of client.pending.values()) clearTimeout(pending.timeout)
    client.ws.close(1001, 'Server shutting down')
  }

  server.close(() => process.exit(0))
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

function rawDataToBuffer(data: RawData): Buffer {
  if (Array.isArray(data)) return Buffer.concat(data)
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  return Buffer.from(data)
}