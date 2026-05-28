# Database Migrations (Flyway)

This project uses Flyway for schema migrations in services that use relational databases.

Currently integrated services:
- `auth-user-service` — migrations located at `auth-user-service/src/main/resources/db/migration`
- `purchase-service` — migrations located at `purchase-service/src/main/resources/db/migration`

- Configuration
- Flyway migrations are now executed from CI (GitHub Actions). The applications have been updated to disable automatic Flyway execution on startup in production for the services managed by CI.
- Migration scripts are still read from `classpath:db/migration` (Spring Boot/Flyway default).
  - `spring.flyway.baseline-on-migrate=true` is set to avoid issues when introducing Flyway to an existing DB.

Best practices
1. Do migrations in CI or as a separate deployment step in production. Running migrations automatically on application startup is convenient for small deployments, but CI-driven migrations are safer for production (pre-checks, approvals, backups).
2. Keep migrations immutable: never modify an already deployed migration script. Add a new migration for changes.
3. Use descriptive filenames: `V1__create_users.sql`, `V2__add_index_to_users.sql`.
4. Test migrations against a copy of production schema before running on production.

Run migrations locally
- From a service directory (example: `auth-user-service`) run:

```bash
mvn -f services/auth-user-service -Dflyway.url="jdbc:postgresql://HOST:PORT/DB?sslmode=verify-ca&sslrootcert=./ca/aiven-ca.pem" \
  -Dflyway.user=DB_USER \
  -Dflyway.password=DB_PASSWORD \
  flyway:migrate
```

Run migrations from CI
----------------------
The repository includes a GitHub Actions workflow at `.github/workflows/flyway-migrations.yml` that runs migrations for `auth-user-service` and `purchase-service`.

Required repository secrets (set in GitHub):
- `AUTH_DB_URL`, `AUTH_DB_USER`, `AUTH_DB_PASSWORD`
- `PURCHASE_DB_URL`, `PURCHASE_DB_USER`, `PURCHASE_DB_PASSWORD`

Make sure to run the workflow manually (`workflow_dispatch`) or wire it into your deployment pipeline before deploying new code that depends on schema changes.

CI / GitHub Actions example (recommended)
- Example step to run Flyway migrations using Maven in GitHub Actions:

```yaml
name: Run DB Migrations
on:
  workflow_dispatch:
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
      - name: Run Flyway migrations for auth-user-service
        env:
          FLYWAY_URL: ${{ secrets.AUTH_DB_URL }}
          FLYWAY_USER: ${{ secrets.AUTH_DB_USER }}
          FLYWAY_PASSWORD: ${{ secrets.AUTH_DB_PASSWORD }}
        run: |
          mvn -f services/auth-user-service -Dflyway.url="$FLYWAY_URL" -Dflyway.user="$FLYWAY_USER" -Dflyway.password="$FLYWAY_PASSWORD" flyway:migrate

      - name: Run Flyway migrations for purchase-service
        env:
          FLYWAY_URL: ${{ secrets.PURCHASE_DB_URL }}
          FLYWAY_USER: ${{ secrets.PURCHASE_DB_USER }}
          FLYWAY_PASSWORD: ${{ secrets.PURCHASE_DB_PASSWORD }}
        run: |
          mvn -f services/purchase-service -Dflyway.url="$FLYWAY_URL" -Dflyway.user="$FLYWAY_USER" -Dflyway.password="$FLYWAY_PASSWORD" flyway:migrate
```

Notes:
- Store DB connection strings and credentials in your CI secret store (never in the repo).
- Consider running migrations as a separate, manual job for production with deployment approvals.

Rollback strategy
- Flyway does not support automatic rollbacks for arbitrary SQL changes. Use backups and create compensating migrations for reversal.

Next steps
- Add Flyway to other services that use relational DBs (if any).
- Add pre-deploy checks (linting migrations, verifying no destructive operations without approval).
- Optionally add a Flyway command-line container step instead of using Maven.
