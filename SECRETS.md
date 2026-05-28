# Secret Management Guide

## Overview
This project uses environment variables for secrets management. **NEVER commit actual credentials to GitHub.**

## File Structure

- **`.env.example`** — Template files with placeholder values (OK to commit)
  - Located in each service directory and `services/` root
  - Use as a reference for required environment variables

- **`.env`** — Actual credentials (⚠️ DO NOT COMMIT)
  - Already excluded by `.gitignore`
  - Contains real database URIs, API keys, and passwords
  - Copy from `.env.example` and fill with actual values

## Setup Instructions

### 1. Create `.env` Files for Each Service

```bash
# From services/ directory
cp .env.example .env
cp auth-user-service/.env.example auth-user-service/.env
cp game-service/.env.example game-service/.env
cp purchase-service/.env.example purchase-service/.env
cp storage-service/.env.example storage-service/.env
cp wishlist-service/.env.example wishlist-service/.env
cp gateway/.env.example gateway/.env
cp notification-service/.env.example notification-service/.env
```

### 2. Fill in Actual Values

Edit each `.env` file and replace placeholders with real credentials:
- MongoDB Atlas URIs
- JWT secret (minimum 32 characters; recommend: `openssl rand -base64 32`)
- Kafka API keys and bootstrap servers
- Redis connection details
- Database passwords

### 3. Local Development

When running services locally:
```bash
# Load environment variables from .env
export $(cat services/.env | xargs)
export $(cat services/auth-user-service/.env | xargs)
# Then start services...
```

Or use IDE/editor integration to automatically load `.env` files.

### 4. Docker Compose

When using Docker Compose:
```bash
# From services/ directory
docker compose up --build
```

The `docker-compose.yml` references `env_file` for each service:
```yaml
services:
  auth-user:
    env_file:
      - ./auth-user-service/.env
```

## Secret Rotation

### JWT Secret Rotation
1. Generate a new secret: `openssl rand -base64 32`
2. Update `JWT_SECRET` in all service `.env` files
3. Restart services
4. Existing JWT tokens become invalid (users need to re-login)

### Database Credentials
1. Rotate credentials in MongoDB Atlas / PostgreSQL
2. Update `*_MONGO_URI` or `POSTGRES_*` in `.env` files
3. Restart services

### API Keys (Kafka, Redis)
1. Rotate keys in Aiven / Redis Cloud console
2. Update `KAFKA_API_*` or `REDIS_PASSWORD` in `.env`
3. Restart services

## Production Considerations

### For CI/CD Pipelines
- Store secrets in a secret manager (GitHub Secrets, AWS Secrets Manager, HashiCorp Vault, etc.)
- Never pass secrets as inline environment variables in CI logs
- Use masked variables in GitHub Actions:
  ```yaml
  env:
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
    POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
  ```

### For Kubernetes Deployments
- Use Kubernetes Secrets:
  ```bash
  kubectl create secret generic app-secrets \
    --from-literal=JWT_SECRET=<value> \
    --from-literal=POSTGRES_PASSWORD=<value>
  ```
- Reference secrets in pod specs (not as environment variables in manifests)

### TLS/SSL Configuration
For PostgreSQL with certificate verification (`sslmode=verify-ca`):
1. Obtain CA certificate (e.g., from Aiven)
2. Place in service directory: `auth-user-service/ca/aiven-ca.pem`
3. Update `.env`: `POSTGRES_JDBC_URL=...?sslmode=verify-ca&sslrootcert=./ca/aiven-ca.pem`
4. The `docker-compose.yml` mounts this certificate into the container

## Checking for Leaked Secrets

Before committing, verify no secrets are in git:

```bash
# Check for common secret patterns
git diff --cached | grep -iE "(password|secret|token|key|api)" || echo "✓ No obvious secrets found"

# Check .env file is excluded
git check-ignore services/.env && echo "✓ .env is properly ignored" || echo "⚠️ .env is NOT ignored!"
```

If secrets were accidentally committed:
1. Do **NOT** push to GitHub
2. Use `git reset HEAD <file>` to unstage
3. Use `BFG Repo-Cleaner` or `git filter-branch` to remove from history if already pushed
4. Rotate all exposed secrets immediately

## References

- [GitHub - Secrets in Environment Variables](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [12 Factor App - Config](https://12factor.net/config)
- [OWASP - Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
