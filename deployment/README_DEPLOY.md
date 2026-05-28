Gateway-first deployment (Vercel frontend + single public Render gateway)
=================================================

Summary
-------
This repo uses a single public web service (the nginx gateway) to expose the API. All backend services remain private or internal. The frontend (Vercel) points to the gateway URL.

Render (gateway)
-----------------
1. Create a Render Web Service.
   - Name: gateway
   - Environment: Docker
   - Dockerfile Path: `deployment/Dockerfile.nginx`
   - Build context: repository root
   - Health check path: `/_health`
2. Add environment variables (internal hostnames or placeholders until backends exist):
   - `GAME_SERVICE_HOST` => `game-service:8082`
   - `PURCHASE_SERVICE_HOST` => `purchase-service:8083`
   - `WISHLIST_SERVICE_HOST` => `wishlist-service:8084`
   - `NOTIFICATION_SERVICE_HOST` => `notification-service:8085`
   - `AUTH_SERVICE_HOST` => `auth-user-service:8087`
   - `STORAGE_SERVICE_HOST` => `storage-service:8086`

Vercel (frontend)
------------------
1. Import the `client/` project into Vercel.
2. Set project environment variables for production (point to gateway):
   - `VITE_API_ROOT = https://api.game-spotlight.onrender.com` (gateway base, no trailing `/api`)
3. Optional: use `client/vercel.json` to rewrite `/api/*` to the gateway domain.

Notes
-----
- Replace `api.yourdomain.com` with your real gateway domain.
- Rotate any leaked credentials before enabling production traffic.
- Consider marking backend services private/internal in Render and use internal hostnames for gateway envs.
