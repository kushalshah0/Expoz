#!/usr/bin/env node
import { createTunnel } from './index.js'
import readline from 'readline'

const args = process.argv.slice(2)
const port = parseInt(args[0]) || 3000
const server = process.env.EXPOZ_SERVER || 'wss://expoz.onrender.com'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('? Enter tunnel ID (leave blank for random): ', (answer) => {
  rl.close()
  const tunnelId = answer.trim() || null
  console.log(`Starting expoz on localhost:${port}`)
  createTunnel({ port, server, tunnelId })
})