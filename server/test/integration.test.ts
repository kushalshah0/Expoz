import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { spawn, type ChildProcess } from 'node:child_process'
import type { AddressInfo } from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'

interface TunnelHandle {
  stop: () => void
}

interface CreateTunnelOptions {
  port: number
  server: string
  tunnelId: string
  onUrl: (url: string) => void
}

async function listen(server: http.Server): Promise<number> {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return (server.address() as AddressInfo).port
}

async function waitForOutput(process: ChildProcess, text: string): Promise<void> {
  const stdout = process.stdout
  if (!stdout) throw new Error('Server stdout is unavailable')

  await new Promise<void>((resolve, reject) => {
    let output = ''
    const onData = (chunk: Buffer) => {
      output += chunk.toString()
      if (output.includes(text)) {
        stdout.off('data', onData)
        resolve()
      }
    }

    stdout.on('data', onData)
    process.once('error', reject)
    process.once('exit', (code) => {
      reject(new Error(`Server exited before startup with code ${code}: ${output}`))
    })
  })
}

test('proxies GET and POST requests through a real tunnel', async (t) => {
  const localApp = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString()
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ method: req.method, url: req.url, body }))
    })
  })
  const localPort = await listen(localApp)

  const serverEntryPath = fileURLToPath(new URL('../dist/index.js', import.meta.url))
  const serverProcess = spawn(process.execPath, [serverEntryPath], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    env: {
      ...process.env,
      BASE_URL: 'http://127.0.0.1:3001',
      PORT: '3001',
      RATE_LIMIT_MAX_REQUESTS: '100'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  t.after(() => {
    serverProcess.kill('SIGTERM')
    localApp.close()
  })

  await waitForOutput(serverProcess, 'Expoz server running')

  const homepageResponse = await fetch('http://127.0.0.1:3001/')
  assert.equal(homepageResponse.status, 200)
  const homepage = await homepageResponse.text()
  assert.match(homepage, /Your localhost,?<br>/)
  assert.match(homepage, /Start tunneling/)

  const healthResponse = await fetch('http://127.0.0.1:3001/health')
  assert.equal(healthResponse.status, 200)
  assert.deepEqual(await healthResponse.json(), { ok: true })

  const clientModulePath = pathToFileURL(fileURLToPath(new URL('../../client/index.ts', import.meta.url))).href
  const { createTunnel } = await import(clientModulePath) as {
    createTunnel: (options: CreateTunnelOptions) => TunnelHandle
  }

  let publicUrl = ''
  const tunnel = createTunnel({
    port: localPort,
    server: 'ws://127.0.0.1:3001',
    tunnelId: 'integration-test',
    onUrl: (url) => {
      publicUrl = url
    }
  })
  t.after(() => tunnel.stop())

  for (let attempt = 0; attempt < 50 && !publicUrl; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  assert.ok(publicUrl)
  assert.equal(new URL(publicUrl).pathname, '/t/integration-test')
  const legacyTunnelPath = await fetch('http://127.0.0.1:3001/integration-test/hello')
  assert.equal(legacyTunnelPath.status, 404)

  const getResponse = await fetch(`${publicUrl}/hello?source=test`)
  assert.equal(getResponse.status, 200)
  assert.deepEqual(await getResponse.json(), {
    method: 'GET',
    url: '/hello?source=test',
    body: ''
  })

  const postResponse = await fetch(`${publicUrl}/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true })
  })
  assert.equal(postResponse.status, 200)
  assert.deepEqual(await postResponse.json(), {
    method: 'POST',
    url: '/submit',
    body: '{"ok":true}'
  })

  const largeBody = 'x'.repeat(512 * 1024)
  const largeResponse = await fetch(`${publicUrl}/large`, {
    method: 'POST',
    body: largeBody
  })
  assert.equal(largeResponse.status, 200)
  const largeResult = await largeResponse.json() as { body: string }
  assert.equal(largeResult.body.length, largeBody.length)
  assert.equal(largeResult.body, largeBody)

  const statusResponse = await fetch('http://127.0.0.1:3001/status')
  assert.equal(statusResponse.status, 200)
  const status = await statusResponse.json() as {
    activeTunnels: number
    requestsTotal: number
    responseBytes: number
  }
  assert.equal(status.activeTunnels, 1)
  assert.ok(status.requestsTotal >= 3)
  assert.ok(status.responseBytes > 0)
})
