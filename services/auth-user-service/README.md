# auth-user-service

Standalone Spring Boot service for authentication and user profile data.

## What it does
- Registers users in PostgreSQL.
- Logs in users and returns a JWT.
- Exposes protected `/api/auth/me` and `/api/users/profile` endpoints.

## Run locally

```powershell
cd services/auth-user-service
$env:POSTGRES_JDBC_URL="jdbc:postgresql://<host>:<port>/auth_db?sslmode=require"
$env:POSTGRES_USER="<db_user>"
$env:POSTGRES_PASSWORD="<db_password>"
$env:JWT_SECRET="<minimum_32_char_secret_or_base64_secret>"
mvn spring-boot:run
```

Note: Keep `JWT_SECRET` and DB credentials in environment variables or a secret manager. Do not commit real secrets.

## TLS & Secrets

- Keep TLS root certificates (for `sslmode=verify-ca`) under `services/auth-user-service/ca/` and reference them via the JDBC `sslrootcert` parameter.
- To test TCP reachability from PowerShell:

```powershell
Test-NetConnection -ComputerName gamespotlightdb-gajerautsav08-9ccc.h.aivencloud.com -Port 22498
```

- To generate a 32-byte hex JWT secret in PowerShell:

```powershell
#$rand = -join (1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
Write-Output $rand
```

- Or use OpenSSL to generate a 32-byte base64 secret:

```bash
openssl rand -base64 32
```

- When using `sslmode=verify-ca`, set the JDBC URL like:

```
jdbc:postgresql://<host>:<port>/auth_db?sslmode=verify-ca&sslrootcert=/path/to/ca/aiven-ca.pem
```

- If `verify-ca` fails with a network timeout, try `sslmode=require` temporarily while you verify network/CA settings. Always prefer `verify-ca` for production.

## Build

```powershell
cd services/auth-user-service
mvn -DskipTests package
```

## Docker

```powershell
cd services/auth-user-service
docker build -t auth-user-service:dev .
docker run -p 8087:8087 -e PORT=8087 -e POSTGRES_JDBC_URL="jdbc:postgresql://<host>:<port>/auth_db?sslmode=require" -e POSTGRES_USER="<db_user>" -e POSTGRES_PASSWORD="<db_password>" -e JWT_SECRET="<minimum_32_char_secret_or_base64_secret>" auth-user-service:dev
```