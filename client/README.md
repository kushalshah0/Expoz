# expoz

Expose localhost to the internet instantly.

## Install

```bash
npm install -g @kushalshah0/expoz
```

## Usage

```bash
# expose port 3000
expoz 3000

# you'll be prompted to enter a tunnel ID
# Enter tunnel ID (leave blank for random): myapp
# Exposed at: https://expoz.onrender.com/myapp
```

## Programmatic

```js
import { createTunnel } from '@kushalshah0/expoz'

createTunnel({ port: 3000, tunnelId: 'myapp' })
```

## Self-host

Set your own server:

```bash
EXPOZ_SERVER=wss://your-server.com expoz 3000
```