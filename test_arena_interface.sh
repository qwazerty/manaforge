#!/bin/bash

echo "🎨 Testing ManaForge Magic Arena Interface..."
echo ""

# Test basic connectivity
echo "🌐 Testing application endpoints:"

echo -n "  - Homepage: "
if curl -s -f http://localhost:8000/ > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FAIL"
fi

echo -n "  - API docs: "
if curl -s -f http://localhost:8000/docs > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FAIL"
fi

echo -n "  - Card search API: "
if curl -s -f "http://localhost:8000/api/v1/cards/search?q=lightning" > /dev/null; then
    echo "✅ OK"
else
    echo "❌ FAIL"
fi

echo ""
echo "🃏 Testing card search functionality:"
SEARCH_RESULT=$(curl -s "http://localhost:8000/api/v1/cards/search?q=lightning")
if echo "$SEARCH_RESULT" | grep -q "Lightning Bolt"; then
    echo "✅ Card search returns Lightning Bolt"
else
    echo "❌ Card search failed"
fi

echo ""
echo "🎯 Testing game lobby creation:"
echo -n "  - Create game endpoint: "
CREATE_RESULT=$(curl -s -X POST "http://localhost:8000/api/v1/games" \
  -H "Content-Type: application/json" \
  -d '{"player_name": "TestPlayer"}')

if echo "$CREATE_RESULT" | grep -q "game_id"; then
    echo "✅ OK"
    GAME_ID=$(echo "$CREATE_RESULT" | jq -r '.game_id')
    echo "  Game ID: $GAME_ID"
    
    echo -n "  - Game interface access: "
    if curl -s -f "http://localhost:8000/game-interface/$GAME_ID" > /dev/null; then
        echo "✅ OK"
    else
        echo "❌ FAIL"
    fi
else
    echo "❌ FAIL"
fi

echo ""
echo "🎉 Magic Arena Interface Test Complete!"
