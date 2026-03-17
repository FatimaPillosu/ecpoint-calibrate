#!/usr/bin/env bash
set -e

# Build frontend assets
echo "Building webpack bundle..."
export NODE_OPTIONS=--openssl-legacy-provider
npm run build

# Build and launch Docker containers
echo "Building and starting Docker containers..."
docker compose up --build -d

IP=$(hostname -I | awk '{print $1}')
echo ""
echo "  ecPoint-Calibrate is running!"
echo "  ============================="
echo "  URL: http://${IP}:3000"
echo ""
echo "  Use 'docker compose logs -f' to view logs"
echo "  Use 'docker compose down' to stop"
