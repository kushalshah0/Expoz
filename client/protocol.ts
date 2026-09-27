export interface RegisterMessage {
  type: 'register'
  tunnelId: string | null
}

export interface ConnectedMessage {
  type: 'connected'
  tunnelId: string
  url: string
}

export interface WarnMessage {
  type: 'warn'
  message: string
}

export interface RequestMessage extends Record<string, unknown> {
  type: 'request'
  requestId: string
  method: string
  path: string
  headers: Record<string, string | string[] | undefined>
  body: string
}

export interface RequestStartMessage extends Record<string, unknown> {
  type: 'request_start'
  requestId: string
  method: string
  path: string
  headers: Record<string, string | string[] | undefined>
}

export interface RequestChunkMessage extends Record<string, unknown> {
  type: 'request_chunk'
  requestId: string
  body: string
}

export interface RequestEndMessage extends Record<string, unknown> {
  type: 'request_end'
  requestId: string
}

export interface ResponseMessage extends Record<string, unknown> {
  type: 'response'
  requestId: string
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

export interface ResponseStartMessage extends Record<string, unknown> {
  type: 'response_start'
  requestId: string
  statusCode: number
  headers: Record<string, string | string[] | undefined>
}

export interface ResponseChunkMessage extends Record<string, unknown> {
  type: 'response_chunk'
  requestId: string
  body: string
}

export interface ResponseEndMessage extends Record<string, unknown> {
  type: 'response_end'
  requestId: string
}

export type ServerMessage = ConnectedMessage | WarnMessage | RequestMessage | RequestStartMessage | RequestChunkMessage | RequestEndMessage

export function isValidRequestStartMessage(message: ServerMessage): message is RequestStartMessage {
  return Boolean(
    message.type === 'request_start' &&
    isValidRequestId(message.requestId) &&
    typeof message.method === 'string' &&
    /^[A-Z]+$/.test(message.method) &&
    typeof message.path === 'string' &&
    message.path.length > 0 &&
    message.path.length <= 8192 &&
    isValidHeaders(message.headers)
  )
}

export function isValidRequestChunkMessage(message: ServerMessage): message is RequestChunkMessage {
  return Boolean(message.type === 'request_chunk' && isValidRequestId(message.requestId) && typeof message.body === 'string' && isBase64(message.body))
}

export function isValidRequestEndMessage(message: ServerMessage): message is RequestEndMessage {
  return Boolean(message.type === 'request_end' && isValidRequestId(message.requestId))
}

export function isValidRequestMessage(message: ServerMessage): message is RequestMessage {
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
    typeof message.body === 'string' &&
    isBase64(message.body)
  )
}

function isBase64(value: string): boolean {
  if (value === '') return true
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false
  return Buffer.from(value, 'base64').toString('base64') === value
}

function isValidRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
}

function isValidHeaders(value: unknown): value is Record<string, string | string[] | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
