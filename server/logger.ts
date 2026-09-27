export type LogLevel = 'info' | 'warn' | 'error'

export interface LogFields {
  [key: string]: unknown
}

export function formatLog(level: LogLevel, event: string, fields: LogFields = {}): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields
  })
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const message = formatLog(level, event, fields)
  if (level === 'error') console.error(message)
  else console.log(message)
}
