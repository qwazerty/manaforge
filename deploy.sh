#!/bin/bash

set -e

cd ~/docker/manaforge

echo "### Git pull"
git pull

echo "### Rebuilding and restarting containers"
docker compose up -d --build
echo "### Updating static files and restarting nginx"
docker cp manaforge-api-1:/app/app/static/dist ./app/static/
docker compose restart nginx

echo "### Purging Cloudflare cache"
source .env
curl -XPOST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" -d '{"hosts":["manaforge.houke.fr"]}'
echo
echo "### Deployment complete"