#!/bin/bash
# Test workflows locally with act

set -e

echo "🧪 Testing GitHub Actions locally with act"
echo ""

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "❌ act is not installed. Install with: brew install act"
    exit 1
fi

# Clean cache
echo "🧹 Cleaning cache..."
rm -rf .act-cache
mkdir -p .act-cache

# Test each optimized workflow
echo ""
echo "📊 Testing optimized workflows..."
echo ""

# Test webhook receiver (fastest)
echo "1️⃣ Testing webhook-receiver-optimized.yml"
time act repository_dispatch \
    -W .github/workflows/webhook-receiver-optimized.yml \
    -e <(echo '{"action":"app_webhook","client_payload":{"event":"installation.created","payload":"'"$(echo '{"installation":{"id":123},"repositories":[]}' | base64)"'"}}') \
    --no-cache-workflow \
    2>/dev/null || echo "⚠️ Webhook test failed"

echo ""

# Test pages deploy
echo "2️⃣ Testing pages-deploy-optimized.yml"
time act workflow_dispatch \
    -W .github/workflows/pages-deploy-optimized.yml \
    --no-cache-workflow \
    2>/dev/null || echo "⚠️ Pages test failed"

echo ""

# Test local performance workflow
echo "3️⃣ Testing local performance"
time act workflow_dispatch \
    -W .github/workflows/test-local.yml \
    2>/dev/null || echo "⚠️ Local test failed"

echo ""
echo "✅ Local testing complete!"
echo ""
echo "💡 Tips for faster local testing:"
echo "  - Use --reuse to keep containers running"
echo "  - Use --cache-path for persistent cache"
echo "  - Add -v for verbose output"
echo "  - Use -j <job> to test specific jobs"