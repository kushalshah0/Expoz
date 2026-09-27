import type { RequestMessage, ResponseChunkMessage, ResponseMessage, ResponseStartMessage } from './protocol.js'

const DEFAULT_WINDOW_MS = 60 * 1000
const DEFAULT_MAX_REQUESTS = 60

interface RateLimiterOptions {
  windowMs?: number
  maxRequests?: number
}

export function isValidTunnelId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(value)
}

export function parseJsonMessage(data: Buffer | string): Record<string, unknown> | null {
  try {
    const message = JSON.parse(data.toString())
    return message && typeof message === 'object' && !Array.isArray(message)
      ? message
      : null
  } catch {
    return null
  }
}

export function isValidRequestMessage(message: Record<string, unknown> | null): message is RequestMessage {
  return Boolean(
    message &&
    message.type === 'request' &&
    typeof message.requestId === 'string' &&
    message.requestId.length > 0 &&
    message.requestId.length <= 128 &&
    typeof message.method === 'string' &&
    /^[A-Z]+$/.test(message.method) &&
    typeof message.path === 'string' &&
    message.path.length > 0 &&
    message.path.length <= 8192 &&
    typeof message.headers === 'object' &&
    message.headers !== null &&
    !Array.isArray(message.headers) &&
    typeof message.body === 'string' &&
    isBase64(message.body)
  )
}

export function isValidResponseMessage(message: Record<string, unknown> | null): message is ResponseMessage {
  return Boolean(
    message &&
    message.type === 'response' &&
    typeof message.requestId === 'string' &&
    message.requestId.length > 0 &&
    message.requestId.length <= 128 &&
    Number.isInteger(message.statusCode) &&
    (message.statusCode as number) >= 100 &&
    (message.statusCode as number) <= 599 &&
    typeof message.headers === 'object' &&
    message.headers !== null &&
    !Array.isArray(message.headers) &&
    typeof message.body === 'string' &&
    isBase64(message.body)
  )
}

export function isValidResponseStartMessage(message: Record<string, unknown> | null): message is ResponseStartMessage {
  return Boolean(
    message &&
    message.type === 'response_start' &&
    isValidRequestId(message.requestId) &&
    Number.isInteger(message.statusCode) &&
    (message.statusCode as number) >= 100 &&
    (message.statusCode as number) <= 599 &&
    isValidHeaders(message.headers)
  )
}

export function isValidResponseChunkMessage(message: Record<string, unknown> | null): message is ResponseChunkMessage {
  return Boolean(message && message.type === 'response_chunk' && isValidRequestId(message.requestId) && typeof message.body === 'string' && isBase64(message.body))
}

export function isValidResponseEndMessage(message: Record<string, unknown> | null): message is Record<string, unknown> & { type: 'response_end', requestId: string } {
  return Boolean(message && message.type === 'response_end' && isValidRequestId(message.requestId))
}

export class SlidingWindowRateLimiter {
  private readonly windowMs: number
  private readonly maxRequests: number
  private readonly entries: Map<string, number[]> = new Map()

  constructor({ windowMs = DEFAULT_WINDOW_MS, maxRequests = DEFAULT_MAX_REQUESTS }: RateLimiterOptions = {}) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    this.entries = new Map()
  }

  allow(key: string, now = Date.now()): boolean {
    const timestamps = (this.entries.get(key) || []).filter((timestamp: number) => now - timestamp < this.windowMs)

    if (timestamps.length >= this.maxRequests) {
      this.entries.set(key, timestamps)
      return false
    }

    timestamps.push(now)
    this.entries.set(key, timestamps)
    return true
  }

  cleanup(now = Date.now()): void {
    for (const [key, timestamps] of this.entries) {
      const active = timestamps.filter((timestamp: number) => now - timestamp < this.windowMs)
      if (active.length === 0) this.entries.delete(key)
      else this.entries.set(key, active)
    }
  }
}

function isBase64(value: string): boolean {
  if (value === '') return true
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false
  return Buffer.from(value, 'base64').toString('base64') === value
}

function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
}

function isValidHeaders(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
