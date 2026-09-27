#!/usr/bin/env node
import { createTunnel } from './index.js'
import readline from 'readline'
import { pathToFileURL } from 'node:url'

interface CliArgs {
  port: number
  server: string
  tunnelId: string | null
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
      i += 1
      continue
    }

    if (arg === '--id' || arg === '-i') {
      parsed.tunnelId = argv[i + 1] || null
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

  return parsed
}

export function printHelp() {
  console.log(`Usage: expoz [port] [--id myapp] [--server wss://example.com] [--help]

Options:
  port                   Local port to expose (default: 3000)
  --id, -i <value>       Custom tunnel ID
  --server, -s <url>     Expoz server URL
  --help, -h             Show help
`)
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

  const { port, server, tunnelId: cliTunnelId } = parsedArgs

  if (cliTunnelId) {
    console.log(`Starting expoz on localhost:${port}`)
    const tunnel = createTunnel({ port, server, tunnelId: cliTunnelId })
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
    const tunnel = createTunnel({ port, server, tunnelId })

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