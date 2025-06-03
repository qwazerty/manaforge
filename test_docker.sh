#!/bin/bash

echo "🔍 Testing Magic The Gathering API with Docker Compose..."
echo ""

echo "📋 Checking Docker Compose status:"
docker compose ps

echo ""
echo "🌐 Testing application endpoints:"

echo -n "  - Health endpoint: "
if curl -s -f http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ FAIL"
fi

echo -n "  - Main page: "
if curl -s -f http://localhost:8000/ > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ FAIL"
fi

echo -n "  - API docs: "
if curl -s -f http://localhost:8000/docs > /dev/null 2>&1; then
    echo "✅ OK"
else
    echo "❌ FAIL"
fi

echo ""
echo "📊 Quick API test:"
curl -s http://localhost:8000/api/health | head -n 5

echo ""
echo "🎉 Test completed!"
