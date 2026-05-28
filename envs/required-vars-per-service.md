Per-service environment variables checklist

Use this as a quick reference when populating CI secrets or `.env` files.

Shared / common
- POSTGRES_JDBC_URL, POSTGRES_USER, POSTGRES_PASSWORD — Postgres connection for `auth-user-service` and `purchase-service` (if used)
- JWT_SECRET, JWT_EXPIRATION_SECONDS — JWT signing and lifetime
- KAFKA_BOOTSTRAP_SERVERS, KAFKA_API_KEY, KAFKA_API_SECRET, KAFKA_TRUSTSTORE_LOCATION, KAFKA_SECURITY_PROTOCOL, KAFKA_SASL_MECHANISM — Kafka (Aiven)
- REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_SSL — Redis for caching / idempotency
- BREVO_SMTP_HOST, BREVO_SMTP_PORT, BREVO_SMTP_USERNAME, BREVO_SMTP_PASSWORD, MAIL_FROM_ADDRESS — Transactional email
- IMAGE_PREFIX — container registry prefix (CI)

auth-user-service
- POSTGRES_JDBC_URL
- POSTGRES_USER
- POSTGRES_PASSWORD
- JWT_SECRET
- JWT_EXPIRATION_SECONDS
- AUTH_SUPABASE_URL (optional — only if using Supabase login/session verification)
- AUTH_SUPABASE_ANON_KEY (optional)
- PORT

purchase-service
- PURCHASE_MONGO_URI (or PURCHASE_MONGO_URI if using Mongo)
- POSTGRES_JDBC_URL, POSTGRES_USER, POSTGRES_PASSWORD (if using Postgres migrations/queries)
- JWT_SECRET
- KAFKA_BOOTSTRAP_SERVERS, KAFKA_API_KEY, KAFKA_API_SECRET, KAFKA_TRUSTSTORE_LOCATION
- REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_SSL
- BREVO_SMTP_HOST, BREVO_SMTP_PORT, BREVO_SMTP_USERNAME, BREVO_SMTP_PASSWORD, MAIL_FROM_ADDRESS
- AUTH_USER_SERVICE_URL, GAME_SERVICE_URL
- PORT

game-service
- GAME_MONGO_URI (primary)
- MONGO_URI (alias; set if service reads generic name)
- JWT_SECRET
- KAFKA_BOOTSTRAP_SERVERS, KAFKA_API_KEY, KAFKA_API_SECRET, KAFKA_TRUSTSTORE_LOCATION
- REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_SSL
- STORAGE_SERVICE_URL
- AUTH_USER_SERVICE_URL
- OPENSEARCH_* (if enabled): OPENSEARCH_HOST, OPENSEARCH_PORT, OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD, OPENSEARCH_INDEX
- PORT

notification-service
- MONGO_URI
- KAFKA_BOOTSTRAP_SERVERS, KAFKA_API_KEY, KAFKA_API_SECRET, KAFKA_TRUSTSTORE_LOCATION
- BREVO_SMTP_USERNAME, BREVO_SMTP_PASSWORD, MAIL_FROM_ADDRESS
- AUTH_USER_SERVICE_URL, GAME_SERVICE_URL
- PORT

storage-service
- STORAGE_MONGO_URI
- STORAGE_SUPABASE_URL, STORAGE_SUPABASE_KEY (if using Supabase)
- SUPABASE_BUCKET_GAME_FILES, SUPABASE_BUCKET_GAME_IMAGES
- STORAGE_PROVIDER (local|s3|gcs)
- STORAGE_BUCKET_NAME, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY (if S3/GCS)
- PORT

wishlist-service
- WISHLIST_MONGO_URI
- MONGO_URI (alias; set to same value to satisfy services that read generic name)
- JWT_SECRET
- PORT

gateway / other services
- Check per-service `.env.example` for service-specific entries (gateway, notification, etc.)

Notes & recommendations
- Prefer putting secrets in CI/CD secret stores (GitHub Secrets, environment of the host, or vault).
- For each service, copy and fill `services/<service>/.env.example` (or `envs/production.env.example`) and do NOT commit the filled `.env`.
- Ensure `KAFKA_TRUSTSTORE_LOCATION` points to a path available in the container and mount the CA/truststore via secrets or volumes.
- If a service expects a generic `MONGO_URI`, set both the generic name and the service-specific name to avoid mismatch.

If you want, I can now:
- Generate a per-service checklist file in CSV or JSON format for automation.
- Update each `services/<service>/.env.example` to exactly match the required names (already largely synced).
