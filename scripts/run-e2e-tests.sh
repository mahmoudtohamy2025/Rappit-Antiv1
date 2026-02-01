#!/bin/bash

# E2E Test Runner Script
# Runs comprehensive E2E tests with testcontainers

set -e

echo "🧪 Starting E2E Test Suite with Testcontainers"
echo "=============================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running"
  echo "Please start Docker and try again"
  exit 1
fi

echo "✅ Docker is running"

# Set environment variables
export NODE_ENV=test
export USE_TESTCONTAINERS=true
export LOG_LEVEL=${LOG_LEVEL:-error}

# Run tests based on argument
if [ "$1" = "all" ]; then
  echo "🚀 Running all E2E tests..."
  npx jest src/test/e2e --runInBand --detectOpenHandles --config src/jest.config.js
elif [ "$1" = "lifecycle" ]; then
  echo "🚀 Running order lifecycle tests..."
  npx jest src/test/e2e/order-lifecycle.e2e-spec.ts --runInBand --config src/jest.config.js
elif [ "$1" = "security" ]; then
  echo "🚀 Running security tests..."
  npx jest src/test/e2e/security-tenant-isolation.e2e-spec.ts --runInBand --config src/jest.config.js
elif [ "$1" = "chaos" ]; then
  echo "🚀 Running chaos engineering tests..."
  npx jest src/test/e2e/chaos-engineering.e2e-spec.ts --runInBand --config src/jest.config.js
elif [ "$1" = "concurrent" ]; then
  echo "🚀 Running concurrent inventory tests..."
  npx jest src/test/e2e/concurrent-inventory.e2e-spec.ts --runInBand --config src/jest.config.js
elif [ "$1" = "webhook" ]; then
  echo "🚀 Running webhook flow tests..."
  npx jest src/test/e2e/webhook-queue-flow.e2e-spec.ts --runInBand --config src/jest.config.js
elif [ "$1" = "billing" ]; then
  echo "🚀 Running billing enforcement tests..."
  npx jest src/test/e2e/stripe-billing-enforcement.e2e-spec.ts --runInBand --config src/jest.config.js
elif [ "$1" = "ratelimit" ]; then
  echo "🚀 Running rate limiting tests..."
  npx jest src/test/e2e/rate-limiting.e2e-spec.ts --runInBand --config src/jest.config.js
elif [ "$1" = "cancel" ]; then
  echo "🚀 Running order cancellation tests..."
  npx jest src/test/e2e/order-cancellation.e2e-spec.ts --runInBand --config src/jest.config.js
else
  echo "Usage: ./run-e2e-tests.sh [test-suite]"
  echo ""
  echo "Available test suites:"
  echo "  all          - Run all E2E tests"
  echo "  lifecycle    - Order lifecycle tests"
  echo "  security     - Security and tenant isolation tests"
  echo "  chaos        - Chaos engineering tests"
  echo "  concurrent   - Concurrent inventory tests"
  echo "  webhook      - Webhook queue flow tests"
  echo "  billing      - Billing enforcement tests"
  echo "  ratelimit    - Rate limiting tests"
  echo "  cancel       - Order cancellation tests"
  echo ""
  echo "Example: ./run-e2e-tests.sh all"
  exit 1
fi

echo ""
echo "✅ E2E Tests Complete"
echo "=============================================="
