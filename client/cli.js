#!/usr/bin/env node
import { createTunnel } from './index.js'

const args = process.argv.slice(2)
const port = parseInt(args[0]) || 3000
const server = args[1] || 'wss://your-app.onrender.com'

console.log(`Starting tunnel for localhost:${port}`)
createTunnel({ port, server })