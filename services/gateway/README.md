# gateway

Spring Cloud Gateway that routes requests to microservices.

Routes (local compose service names):
- `/api/auth/**` -> auth-user (8087)
- `/api/games/**` -> game (8082)
- `/api/purchases/**` -> purchase (8083)
- `/api/wishlist/**` -> wishlist (8084)
- `/api/storage/**` -> storage (8085)

Run locally (via compose):

```powershell
cd services
docker compose up --build gateway
```
