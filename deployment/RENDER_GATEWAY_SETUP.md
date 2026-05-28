Render Gateway — Setup Guide
============================

This document describes step-by-step instructions and exact environment variable names/values to deploy the single public gateway (nginx) on Render, plus an example `render.yaml` you can use for Infrastructure-as-Code.

If you want the free-only version, use [FREE_ONLY_SETUP.md](FREE_ONLY_SETUP.md) instead.

Quick summary
-------------
- Service: Gateway (nginx) — exposes `/api/*` and proxies to internal backend services.
- Dockerfile: `deployment/Dockerfile.nginx`
- Entrypoint: `services/nginx/docker-entrypoint.sh` (substitutes `@VAR@` tokens with env values)
- Health endpoint: `/_health`

Exact environment variable names (keys)
-------------------------------------
Use these keys in Render. Replace example values with your actual internal hostnames or Render private hostnames.

- `GAME_SERVICE_HOST` => `game-service:8082`
- `PURCHASE_SERVICE_HOST` => `purchase-service:8083`
- `WISHLIST_SERVICE_HOST` => `wishlist-service:8084`
- `NOTIFICATION_SERVICE_HOST` => `notification-service:8085`
- `AUTH_SERVICE_HOST` => `auth-user-service:8087`
- `STORAGE_SERVICE_HOST` => `storage-service:8086`

Notes about values
- The values above are examples matching local/test service names. On Render, if you deploy backend services in the same Render team/private networking, use the internal hostname Render provides (or the service name if Render resolves it). If uncertain, set the value temporarily to the private/internal URL shown in Render's dashboard for each service.

Render UI steps (recommended)
-----------------------------
1. In Render dashboard, click "New" → "Web Service".
2. Connect the GitHub repo and select the branch you want to auto-deploy from.
3. Set the following service settings:
   - Name: `gateway`
   - Environment: `Docker`
   - Dockerfile Path: `deployment/Dockerfile.nginx`
   - Root Directory / Build Context: repository root
   - Health Check Path: `/_health`
   - Instance Type / Plan: choose according to traffic (e.g., `Starter` for testing, `Standard-1` for production)
4. Under "Environment" (Environment Variables), add the keys from "Exact environment variable names" above and their values.
5. (Optional) Mark any secret values as `Secret` in Render if you add credentials.
6. Save and click "Create Web Service". Render will build the image and deploy.

Important note
--------------
The example backend hostnames in this document are local-development placeholders. For a free-only setup, use [FREE_ONLY_SETUP.md](FREE_ONLY_SETUP.md).

render.yaml example (IaC)
-------------------------
You can also declare the service in a `render.yaml` file in repo root. Example:

```yaml
services:
  - type: web
    name: gateway
    env: docker
    region: oregon
    plan: starter
    dockerfilePath: deployment/Dockerfile.nginx
    buildCommand: ''
    startCommand: ''
    healthCheckPath: /_health
    envVars:
      - key: GAME_SERVICE_HOST
        value: game-service:8082
      - key: PURCHASE_SERVICE_HOST
        value: purchase-service:8083
      - key: WISHLIST_SERVICE_HOST
        value: wishlist-service:8084
      - key: NOTIFICATION_SERVICE_HOST
        value: notification-service:8085
      - key: AUTH_SERVICE_HOST
        value: auth-user-service:8087
      - key: STORAGE_SERVICE_HOST
        value: storage-service:8086
    autoDeploy: true

# If you prefer to keep actual hostnames/URLs secret, remove the 'value' fields and set them in the Render UI instead.
```

DNS and domain
--------------
- After the service is deployed, assign a custom domain (for example `api.game-spotlight.onrender.com` or a name under your domain) in Render's dashboard.
- Configure DNS (CNAME) to point to the Render domain as instructed by Render.

Verification & smoke tests
--------------------------
1. Once deployed, check Render build logs to ensure the Docker image built successfully.
2. Verify health:

```bash
curl -i https://<your-gateway-domain>/_health
# Expected: HTTP/200 with body 'OK'
```

3. Test a proxied request to a backend through the gateway:

```bash
curl -i https://<your-gateway-domain>/api/games/health
# Adjust endpoint according to backend; expect backend-specific response or 200/204.
```

Security notes
--------------
- Rotate any leaked credentials (SSH keys, DB passwords) immediately before enabling production traffic.
- Keep backend services private/internal; do not expose them to the public internet if the gateway is intended to be the only public surface.
- Use Render's secret management for any sensitive values.

Troubleshooting
---------------
- If nginx fails with "host not found in upstream" when Render runs the container, the gateway cannot resolve the backend hostnames. Confirm that the service names or URLs you set are actually reachable from the gateway container.
- For local testing, use `host.docker.internal:PORT` as environment values when running the gateway container on your machine (we already use this pattern in local compose/run).

Next steps checklist
--------------------
1. Ensure leaked credentials are rotated (critical).
2. Deploy backend services to Render as private services (if not already done).
3. Create the `gateway` Web Service in Render and set env vars using internal hostnames.
4. Assign domain and set Vercel envs to point the frontend to the gateway domain.

If you want, I can produce a ready-to-commit `render.yaml` with blanked out values for secrets and create a small PR in this repo; tell me whether to include actual example values or placeholders.
