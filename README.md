# expoz

[![npm](https://img.shields.io/npm/v/@kushalshah0/expoz)](https://www.npmjs.com/package/@kushalshah0/expoz)
[![npm downloads](https://img.shields.io/npm/dm/@kushalshah0/expoz)](https://www.npmjs.com/package/@kushalshah0/expoz)

Expose your localhost to the internet instantly.

No port forwarding, no static IPs, no configuration files — just run one command and get a public HTTPS URL that tunnels traffic to your local development server.

## How it works

```
┌─────────────┐   WebSocket    ┌──────────────┐    HTTPS     ┌─────────────┐
│ Your local  │ ←────────────→ │ expoz server │ ←──────────→ │  visitor on │
│  app :3000  │   /register    │ (expoz.on…)  │  /t/:tunnelId│   the web   │
└─────────────┘                └──────────────┘              └─────────────┘
```

1. The `expoz` CLI opens a WebSocket connection to the server (`/register`) and claims a tunnel ID.
2. The server responds with a public URL like `https://expoz.onrender.com/t/myapp`.
3. When someone visits that URL, the server routes the HTTP request over the WebSocket to your local machine.
4. Your client forwards it to `localhost:<port>`, streams the response back, and the server relays it to the visitor.

Built on `ws`, `express`, and `nanoid`. No ngrok-style binary — plain Node.js.

## Features

- **Instant HTTPS URL** for any local server
- **Custom tunnel IDs** — pick your own tunnel path, or get a random one
- **Any HTTP method** — GET, POST, PUT, DELETE, PATCH, etc.
- **Request bodies** streamed over the tunnel (JSON, forms, file uploads)
- **Automatic reconnection** — the client reconnects every 3s on drop, keeping your ID
- **Self-hostable** — run your own server with one env var
- **Zero-config** — `expoz 3000` just works

## Project structure

```
.
├── client/               # The npm package (@kushalshah0/expoz)
│   ├── index.ts          # createTunnel() — programmatic API + request proxying
│   ├── cli.ts            # expoz CLI — interactive tunnel ID prompt
│   └── package.json
├── web/                  # Next.js public site
│   └── src/app/           # App Router pages and styles
├── server/               # The tunnel server (deployed on Render)
│   └── index.ts          # WebSocket registry + HTTP proxy
└── .env                  # Local env vars (gitignored)
```

## Install

```bash
npm install -g @kushalshah0/expoz
```

## Usage

Start any local server (e.g. on port 3000), then:

```bash
expoz 3000
```

The generated URL is printed as a clickable terminal link in terminals that support Ctrl+click links.

Reconnect behavior can be tuned with `--reconnect-delay <ms>` and `--max-reconnect-delay <ms>`.

You'll be prompted for a tunnel ID:

```
Enter tunnel ID (leave blank for random): myapp
Exposed at: https://expoz.onrender.com/t/myapp
```

Hit the URL from anywhere — it proxies to `http://localhost:3000`.

### Custom tunnel IDs

```bash
expoz 3000
# Enter tunnel ID (leave blank for random): myapp
# Exposed at: https://expoz.onrender.com/t/myapp
```

If the requested ID is taken, the server warns and assigns a random one.

### Random ID

Press Enter at the prompt to get a random ID:

```
Enter tunnel ID (leave blank for random):
Exposed at: https://expoz.onrender.com/t/k8fj2mxp
```

## Programmatic usage

```js
import { createTunnel } from '@kushalshah0/expoz'

const stop = createTunnel({
  port: 3000,                     // local port to expose
  tunnelId: 'myapp',              // optional: custom ID (null = random)
  server: 'wss://expoz.onrender.com', // optional: override server
  onUrl: (url) => console.log(url)   // optional: callback with public URL
})
```

## Self-hosting the server

Point the client at your own server:

```bash
# run the client against your server
EXPOZ_SERVER=wss://your-server.com expoz 3000
```

### Run locally

Run the Next.js frontend in one terminal:

```bash
cd web
npm ci
npm run dev
```

Run the relay backend in another terminal:

```bash
cd server
npm ci
BASE_URL=http://localhost:3001 KEEP_ALIVE_URL=http://localhost:3001/health npm start
```

Open the website at `http://localhost:3000` and the relay at `http://localhost:3001`. For a local tunnel test, run `EXPOZ_SERVER=ws://localhost:3001 expoz 3000` against an app listening on another local port. Vercel's same-host rewrites are exercised by a Vercel Preview deployment.

### Deploy on Render

Create a Node web service with `server/` as its root directory. Use these commands:

```bash
# Build command
npm ci && npm run build

# Start command
node dist/index.js
```

The build copies the relay's legacy fallback page into `dist/public`, so the compiled server can be started independently of its working directory.

### Deploy the web app on Vercel

Import the repository as a Vercel project and configure:

- Framework preset: Next.js
- Root directory: `web`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: leave the Next.js default

The project reads `web/vercel.json`, which rewrites `/health`, `/status`, and `/t/:id` requests to the Render relay. Attach the public/custom domain to Vercel. The page and its assets are served by Vercel; tunnel HTTP traffic is forwarded to Render.

On the Render relay service, set `BASE_URL=https://<your-vercel-domain>` so registration returns tunnel URLs on the Vercel host. Set `KEEP_ALIVE_URL=https://<your-relay>.onrender.com/health` so Render's keep-alive pings the relay itself, not the Vercel site. Do not set `WEB_URL`.
  
The shared public hostname serves the Next.js site at `/`, and Vercel forwards `/health`, `/status`, and `/t/:tunnelId` to Render. The CLI's registration WebSocket connects directly to the relay's Render hostname (`wss://<your-relay>.onrender.com/register`); Vercel does not need to proxy that connection. Set `EXPOZ_SERVER=wss://<your-relay>.onrender.com` when the relay is not at the client's default `expoz.onrender.com`. Tunnel URLs use `/t/:tunnelId`; old `/:tunnelId` links need to be replaced after deploying this route change.

The current `/status` endpoint reports server-wide in-memory metrics, not per-user tunnel data. Add authentication, tunnel ownership, and authorized dashboard APIs before exposing user-specific controls or metrics.

Optional server limits can be configured with `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, and `MAX_BODY_BYTES`. The server exposes `/health` and `/status` endpoints; `/status` reports active tunnels, request/response totals, errors, and transferred bytes.

Server lifecycle and WebSocket errors are emitted as JSON log events with `timestamp`, `level`, and `event` fields.

## How the protocol works

Messages are JSON over a single WebSocket per tunnel:

| Direction | Message                    | Purpose                          |
| --------- | -------------------------- | -------------------------------- |
| Client →  | `{ type: 'register', tunnelId }` | Claim a tunnel ID            |
| Server →  | `{ type: 'connected', tunnelId, url }` | Confirm and hand out URL |
| Server →  | `{ type: 'request_start', requestId, method, path, headers }` | Start HTTP request |
| Server →  | `{ type: 'request_chunk', requestId, body }` | Stream request data |
| Server →  | `{ type: 'request_end', requestId }` | Finish HTTP request |
| Client →  | `{ type: 'response_start', requestId, statusCode, headers }` | Start HTTP response |
| Client →  | `{ type: 'response_chunk', requestId, body }` | Stream response data |
| Client →  | `{ type: 'response_end', requestId }` | Finish HTTP response |
| Server →  | `{ type: 'warn', message }` | e.g. custom ID already taken     |

HTTP data chunks are base64-encoded inside the messages; the server keeps a map of pending requests keyed by `requestId`.

## Development

```bash
git clone https://github.com/kushalshah0/Expoz.git
cd Expoz

# client
cd client && npm install && npm run build && npm test

# server
cd ../server && npm install && npm run build && npm test
```

The client package publishes compiled files from `client/dist`. The server starts from its compiled `server/dist` output.

Pull requests and pushes run the same client/server builds, tests, tunnel integration test, and npm package validation through GitHub Actions.

## License

[MIT](LICENSE)