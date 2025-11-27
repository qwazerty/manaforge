#!/bin/bash
# Script to update data files from Scryfall and Cardmarket APIs

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data"

echo "=== Updating ManaForge data files ==="

# Create data directory if it doesn't exist
mkdir -p "$DATA_DIR"

# 1. Fetch Scryfall unique artwork data
echo ""
echo ">>> Fetching Scryfall bulk data metadata..."
SCRYFALL_BULK_URL="https://api.scryfall.com/bulk-data/unique_artwork"
DOWNLOAD_URI=$(curl -s "$SCRYFALL_BULK_URL" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('type') == 'unique_artwork':
    print(data.get('download_uri', ''))
")

if [ -z "$DOWNLOAD_URI" ]; then
    echo "ERROR: Could not find unique_artwork download URI"
    exit 1
fi

echo ">>> Downloading Scryfall unique artwork data..."
echo "    URL: $DOWNLOAD_URI"
wget -q --show-progress "$DOWNLOAD_URI" -O "$DATA_DIR/oracle-cards.json"
echo "    Saved to: $DATA_DIR/oracle-cards.json"

# 2. Fetch Cardmarket product catalog
echo ""
echo ">>> Downloading Cardmarket product catalog..."
wget -q --show-progress "https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_1.json" -O "$DATA_DIR/products_singles_1.json"
echo "    Saved to: $DATA_DIR/products_singles_1.json"

# 3. Fetch Cardmarket price guide
echo ""
echo ">>> Downloading Cardmarket price guide..."
wget -q --show-progress "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_1.json" -O "$DATA_DIR/price_guide_1.json"
echo "    Saved to: $DATA_DIR/price_guide_1.json"

echo ""
echo "=== Data update complete ==="
echo ""
echo "Files updated:"
ls -lh "$DATA_DIR"/*.json
