import WebSocket from 'ws'
import http from 'node:http'
import type { ClientRequestArgs } from 'node:http'
import type { RawData } from 'ws'
import {
  isValidRequestChunkMessage,
  isValidRequestEndMessage,
  isValidRequestMessage,
  isValidRequestStartMessage
} from './protocol.js'
import type { ServerMessage } from './protocol.js'

interface TunnelOptions {
  port?: number
  server?: string
  tunnelId?: string | null
  onUrl?: ((url: string) => void) | null
  onError?: ((error: Error) => void) | null
  reconnectDelay?: number
  maxReconnectDelay?: number
}

interface TunnelHandle {
  stop: () => void
}

const DEFAULT_RECONNECT_MS = 3000
const MAX_RECONNECT_MS = 15000

export function createTunnel({
  port = 3000,
  server = process.env.EXPOZ_SERVER || 'wss://expoz.onrender.com',
  tunnelId = null,
  onUrl = null,
  onError = null,
  reconnectDelay = DEFAULT_RECONNECT_MS,
  maxReconnectDelay = MAX_RECONNECT_MS
}: TunnelOptions = {}): TunnelHandle {
  let ws: WebSocket | null = null
  let reconnectTimer: NodeJS.Timeout | null = null
  let reconnectAttempt = 0
  let isStopped = false
  const activeRequests = new Map<string, http.ClientRequest>()

  const connect = () => {
    if (isStopped) return

    let socket: WebSocket
    try {
      socket = new WebSocket(`${server}/register`)
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause))
      console.error(`Connection error: ${error.message}`)
      if (onError) onError(error)
      isStopped = true
      return
    }
    ws = socket

    socket.on('open', () => {
      reconnectAttempt = 0
      console.log('Connecting to expoz server...')
      socket.send(JSON.stringify({ type: 'register', tunnelId }))
    })

    socket.on('ping', () => socket.pong())

    socket.on('message', (data) => {
      const msg = JSON.parse(rawDataToString(data)) as ServerMessage

      if (msg.type === 'warn') {
        console.log(`! ${msg.message}`)
      }

      if (msg.type === 'connected') {
        console.log(`\nExposed at: ${terminalLink(msg.url)}\n`)
        if (onUrl) onUrl(msg.url)
      }

      if (msg.type === 'request_start') {
        if (!isValidRequestStartMessage(msg)) {
          console.error('Received invalid request start message from expoz server')
          return
        }

        const options: ClientRequestArgs = {
          hostname: 'localhost',
          port,
          path: msg.path,
          method: msg.method,
          headers: {
            ...msg.headers,
            host: `localhost:${port}`
          }
        }
        const req = createLocalRequest(socket, msg.requestId, options)
        activeRequests.set(msg.requestId, req)
        return
      }

      if (msg.type === 'request_chunk') {
        if (!isValidRequestChunkMessage(msg)) {
          console.error('Received invalid request chunk from expoz server')
          return
        }
        const req = activeRequests.get(msg.requestId)
        if (req) req.write(Buffer.from(msg.body, 'base64'))
        return
      }

      if (msg.type === 'request_end') {
        if (!isValidRequestEndMessage(msg)) {
          console.error('Received invalid request end message from expoz server')
          return
        }
        const req = activeRequests.get(msg.requestId)
        if (req) {
          activeRequests.delete(msg.requestId)
          req.end()
        }
        return
      }

      if (msg.type === 'request') {
        if (!isValidRequestMessage(msg)) {
          console.error('Received invalid request message from expoz server')
          return
        }

        const options: ClientRequestArgs = {
          hostname: 'localhost',
          port,
          path: msg.path || '/',
          method: msg.method,
          headers: {
            ...(msg.headers || {}),
            host: `localhost:${port}`
          }
        }

        const req = createLocalRequest(socket, msg.requestId, options)
        if (msg.body) req.write(Buffer.from(msg.body, 'base64'))
        req.end()
      }
    })

    socket.on('close', (code: number) => {
      if (isStopped) return

      if (code === 1008) {
        const error = new Error('Server rejected the tunnel registration')
        console.error(`Connection rejected: ${error.message}`)
        if (onError) onError(error)
        isStopped = true
        return
      }

      const nextDelay = Math.min(reconnectDelay * (2 ** reconnectAttempt), maxReconnectDelay)
      reconnectAttempt += 1
      console.log(`Disconnected. Reconnecting in ${nextDelay}ms...`)

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, nextDelay)
    })

    socket.on('error', (err: Error & { code?: string }) => {
      const message = err.code === 'ECONNREFUSED'
        ? `Server unreachable at ${server}`
        : err.code === 'ENOTFOUND'
          ? `Server hostname could not be resolved: ${server}`
          : err.message
      const error = new Error(message)
      console.error(`Connection error: ${message}`)
      if (onError) onError(error)
    })
  }

  connect()

  return {
    stop() {
      isStopped = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close()
      }
      for (const req of activeRequests.values()) req.destroy()
      activeRequests.clear()
    }
  }
}

function rawDataToString(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString()
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString()
  return data.toString()
}

function terminalLink(url: string): string {
  return `\u001B]8;;${url}\u0007${url}\u001B]8;;\u0007`
}

function createLocalRequest(socket: WebSocket, requestId: string, options: ClientRequestArgs): http.ClientRequest {
  const req = http.request(options, (res) => {
    socket.send(JSON.stringify({
      type: 'response_start',
      requestId,
      statusCode: res.statusCode,
      headers: res.headers
    }))

    res.on('data', (chunk: Buffer) => {
      res.pause()
      socket.send(JSON.stringify({
        type: 'response_chunk',
        requestId,
        body: chunk.toString('base64')
      }), () => res.resume())
    })
    res.on('end', () => {
      socket.send(JSON.stringify({ type: 'response_end', requestId }))
    })
  })

  req.on('error', () => {
    socket.send(JSON.stringify({
      type: 'response_start',
      requestId,
      statusCode: 502,
      headers: { 'content-type': 'application/json' }
    }))
    socket.send(JSON.stringify({
      type: 'response_chunk',
      requestId,
      body: Buffer.from(JSON.stringify({ error: 'Local server unreachable' })).toString('base64')
    }))
    socket.send(JSON.stringify({ type: 'response_end', requestId }))
  })

  return req
}