#!/usr/bin/env node
import { createTunnel } from './index.js'
import readline from 'readline'
import { pathToFileURL } from 'node:url'

interface CliArgs {
  port: number
  server: string
  tunnelId: string | null
  reconnectDelay?: number
  maxReconnectDelay?: number
  help?: boolean
  error?: string
}

export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  const parsed: CliArgs = {
    port: 3000,
    server: process.env.EXPOZ_SERVER || 'wss://expoz.onrender.com',
    tunnelId: null
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--port' || arg === '-p') {
      const value = Number.parseInt(argv[i + 1], 10)
      parsed.port = Number.isFinite(value) ? value : parsed.port
      if (Number.isFinite(value) && (value < 1 || value > 65535)) {
        parsed.error = 'Port must be between 1 and 65535'
      }
      i += 1
      continue
    }

    if (arg === '--server' || arg === '-s') {
      parsed.server = argv[i + 1] || parsed.server
      if (!isWebSocketUrl(parsed.server)) parsed.error = 'Server URL must use ws:// or wss://'
      i += 1
      continue
    }

    if (arg === '--id' || arg === '-i') {
      parsed.tunnelId = argv[i + 1] || null
      if (parsed.tunnelId && !isValidTunnelId(parsed.tunnelId)) {
        parsed.error = 'Tunnel ID must use 3-64 letters, numbers, dashes, or underscores'
      }
      i += 1
      continue
    }

    if (arg === '--reconnect-delay' || arg === '-d' || arg === '--max-reconnect-delay' || arg === '-m') {
      const value = Number(argv[i + 1])
      if (!Number.isInteger(value) || value < 100) {
        parsed.error = 'Reconnect delays must be whole numbers of at least 100ms'
      } else if (arg === '--reconnect-delay' || arg === '-d') {
        parsed.reconnectDelay = value
      } else {
        parsed.maxReconnectDelay = value
      }
      i += 1
      continue
    }

    if (arg === '--help' || arg === '-h') {
      parsed.help = true
      continue
    }

    const numericPort = Number.parseInt(arg, 10)
    if (!Number.isNaN(numericPort) && String(numericPort) === arg) {
      parsed.port = numericPort
      if (numericPort < 1 || numericPort > 65535) {
        parsed.error = 'Port must be between 1 and 65535'
      }
    }
  }

  if (parsed.reconnectDelay && parsed.maxReconnectDelay && parsed.maxReconnectDelay < parsed.reconnectDelay) {
    parsed.error = 'Maximum reconnect delay must be at least the initial delay'
  }

  return parsed
}

export function printHelp() {
  console.log(`Usage: expoz [port] [--id myapp] [--server wss://example.com] [--help]

Options:
  port                   Local port to expose (default: 3000)
  --id, -i <value>       Custom tunnel ID
  --server, -s <url>     Expoz server URL
  --reconnect-delay, -d  Initial reconnect delay in ms (default: 3000)
  --max-reconnect-delay, -m  Maximum reconnect delay in ms (default: 15000)
  --help, -h             Show help
`)
}

function isWebSocketUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'ws:' || url.protocol === 'wss:'
  } catch {
    return false
  }
}

function isValidTunnelId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(value)
}

function startCli(args = process.argv.slice(2)) {
  const parsedArgs = parseCliArgs(args)
  if (parsedArgs.help) {
    printHelp()
    process.exit(0)
  }

  if (parsedArgs.error) {
    console.error(`Error: ${parsedArgs.error}`)
    process.exitCode = 1
    return
  }

  const { port, server, tunnelId: cliTunnelId, reconnectDelay, maxReconnectDelay } = parsedArgs

  if (cliTunnelId) {
    console.log(`Starting expoz on localhost:${port}`)
    const tunnel = createTunnel({ port, server, tunnelId: cliTunnelId, reconnectDelay, maxReconnectDelay })
    process.on('SIGINT', () => {
      tunnel.stop()
      process.exit(0)
    })
    process.on('SIGTERM', () => {
      tunnel.stop()
      process.exit(0)
    })
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  rl.question('Enter tunnel ID (leave blank for random): ', (answer) => {
    rl.close()
    const tunnelId = answer.trim() || null
    console.log(`Starting expoz on localhost:${port}`)
    const tunnel = createTunnel({ port, server, tunnelId, reconnectDelay, maxReconnectDelay })

    process.on('SIGINT', () => {
      tunnel.stop()
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      tunnel.stop()
      process.exit(0)
    })
  })
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectExecution) {
  startCli()
}

export { startCli }