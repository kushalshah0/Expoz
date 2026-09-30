## Expoz web

Standalone Next.js App Router frontend. Vercel serves this app at the public hostname; its rewrites forward relay HTTP paths to the separately hosted Render server. The client connects its registration WebSocket directly to Render.

```bash
npm ci
npm run dev
```

For local development, open the app at `http://localhost:3000` and run the relay separately at `http://localhost:3001`. Vercel Preview deployments exercise the shared-host rewrites.

In Vercel, import the repository as a Next.js project and set the root directory to `web/`. The checked-in `vercel.json` forwards `/health`, `/status`, and `/t/:id` to `https://expoz.onrender.com`. Update those destinations if the Render relay hostname differs. Attach the public/custom domain to the Vercel project.

Validation commands: `npm run lint` and `npm run build`.
