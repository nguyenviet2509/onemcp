#!/usr/bin/env bash
# Generate self-signed TLS cert for internal OneMCP dev/pilot.
# Usage: ./generate-self-signed-tls.sh [CN=onemcp.internal]
set -euo pipefail

CN="${1:-onemcp.internal}"
DIR="$(dirname "$0")/tls"
mkdir -p "$DIR"

openssl req -x509 -nodes -newkey rsa:2048 \
  -days 730 \
  -keyout "$DIR/onemcp.key" \
  -out "$DIR/onemcp.crt" \
  -subj "/CN=$CN/O=OneMCP/OU=Kythuat"

chmod 600 "$DIR/onemcp.key"
echo "TLS cert generated at $DIR/ (CN=$CN)"
