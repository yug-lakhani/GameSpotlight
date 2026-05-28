#!/bin/sh
set -eu

# Consolidated nginx entrypoint: performs placeholder substitution from
# services/nginx/nginx.conf.template into /etc/nginx/nginx.conf and starts
# nginx. This is the tested entrypoint previously developed under deployment/.

TEMPLATE=/etc/nginx/nginx.conf.template
OUT=/etc/nginx/nginx.conf

if [ ! -f "$TEMPLATE" ]; then
  echo "Template $TEMPLATE not found" >&2
  exit 1
fi

: > "$OUT"

VARS="GAME_SERVICE_HOST PURCHASE_SERVICE_HOST WISHLIST_SERVICE_HOST NOTIFICATION_SERVICE_HOST AUTH_SERVICE_HOST STORAGE_SERVICE_HOST"
DEFAULT_GAME_SERVICE_HOST=127.0.0.1:8082
DEFAULT_PURCHASE_SERVICE_HOST=127.0.0.1:8083
DEFAULT_WISHLIST_SERVICE_HOST=127.0.0.1:8084
DEFAULT_NOTIFICATION_SERVICE_HOST=127.0.0.1:8085
DEFAULT_AUTH_SERVICE_HOST=127.0.0.1:8087
DEFAULT_STORAGE_SERVICE_HOST=127.0.0.1:8086

cp "$TEMPLATE" "$OUT"

for var in $VARS; do
  val=""
  # Expand the environment variable named by $var (POSIX-safe)
  eval "val=\${$var:-}" || true
  if [ -z "$val" ]; then
    eval "val=\${DEFAULT_$var:-}" || true
  fi
  esc_val=$(printf '%s' "$val" | sed -e 's/[\/&]/\\&/g')
  # Replace placeholder occurrences like @VAR@ in the output file
  sed -i "s/@${var}@/$esc_val/g" "$OUT" || true
done

if [ "$#" -eq 0 ]; then
  exec nginx -g 'daemon off;'
fi

exec "$@"
