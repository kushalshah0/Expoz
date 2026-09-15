#!/usr/bin/env node
import { createTunnel } from './index.js'

const args = process.argv.slice(2)
const port = parseInt(args[0]) || 3000
const server = args[1] || process.env.EXPOZ_SERVER || 'wss://expoz.onrender.com'

console.log(`Starting expoz on localhost:${port}`)
createTunnel({ port, server })