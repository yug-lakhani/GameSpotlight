Free-only deployment guide
==========================

Goal
----
Run the stack with the lowest possible cost.

Recommended shape
-----------------
- Frontend: Vercel free
- Public API: one Render gateway only
- Backends: either
  - fold them into the gateway app, or
  - keep separate services only if you accept sleep/cold starts on free tiers

What to avoid
-------------
- Do not rely on paid private services if you want a free-only setup.
- Do not expect private/internal networking to be available in a free-only path.

Option A: true free-only single service
--------------------------------------
Best choice if you want the simplest and cheapest setup.

1. Keep the nginx gateway as the only deployed backend service.
2. Move or expose the needed backend logic behind that service.
3. Point the frontend to the gateway with a single env var `VITE_API_ROOT`:

```bash
# Set this in your Vercel / deployment environment (no trailing `/api`)
VITE_API_ROOT=https://api.game-spotlight.onrender.com
```

4. Keep the gateway health endpoint at `/_health`.
5. Redeploy the frontend on Vercel.

Option B: separate services on free tiers
-----------------------------------------
Only use this if you can tolerate cold starts.

1. Create each backend as a normal public service on its free tier.
2. Use public URLs for each backend.
3. Set the gateway env vars to those public URLs or hostnames.
4. Expect the first request after idle to be slower.

Cold-start reality
------------------
- More services means more places that can sleep.
- One public gateway reduces the user-facing surface, but it does not eliminate backend cold starts if the backends are separate and free.

If you want the cheapest practical version, choose Option A.
