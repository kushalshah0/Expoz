export interface RegisterMessage {
  type: 'register'
  tunnelId?: string | null
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
