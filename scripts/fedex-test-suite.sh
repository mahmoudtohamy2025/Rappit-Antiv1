#!/bin/bash

###############################################################################
# FedEx Integration Test Suite
#
# Automated test suite for FedEx integration
#
# Usage:
#   ./scripts/fedex-test-suite.sh
#
# Environment:
#   Requires .env file with FedEx credentials
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_test() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++))
}

print_failure() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++))
}

print_skip() {
    echo -e "${YELLOW}⊘ $1${NC}"
    ((TESTS_SKIPPED++))
}

check_env_vars() {
    local missing=0
    
    if [ -z "$FEDEX_API_KEY" ]; then
        echo -e "${RED}Missing FEDEX_API_KEY${NC}"
        ((missing++))
    fi
    
    if [ -z "$FEDEX_SECRET_KEY" ]; then
        echo -e "${RED}Missing FEDEX_SECRET_KEY${NC}"
        ((missing++))
    fi
    
    if [ -z "$FEDEX_ACCOUNT_NUMBER" ]; then
        echo -e "${RED}Missing FEDEX_ACCOUNT_NUMBER${NC}"
        ((missing++))
    fi
    
    if [ -z "$FEDEX_API_URL" ]; then
        echo -e "${YELLOW}Missing FEDEX_API_URL, using default sandbox${NC}"
        export FEDEX_API_URL="https://apis-sandbox.fedex.com"
    fi
    
    if [ $missing -gt 0 ]; then
        echo -e "\n${RED}Please set missing environment variables in .env file${NC}"
        exit 1
    fi
}

###############################################################################
# Test Functions
###############################################################################

test_oauth_token() {
    print_test "Testing OAuth token generation"
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "${FEDEX_API_URL}/oauth/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=client_credentials&client_id=${FEDEX_API_KEY}&client_secret=${FEDEX_SECRET_KEY}")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" == "200" ]; then
        local access_token=$(echo "$body" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$access_token" ]; then
            print_success "OAuth token generated successfully"
            echo "  Token: ${access_token:0:20}..."
            export FEDEX_ACCESS_TOKEN="$access_token"
            return 0
        else
            print_failure "OAuth token response missing access_token"
            echo "  Response: $body"
            return 1
        fi
    else
        print_failure "OAuth token request failed (HTTP $status)"
        echo "  Response: $body"
        return 1
    fi
}

test_create_shipment() {
    print_test "Testing shipment creation"
    
    if [ -z "$FEDEX_ACCESS_TOKEN" ]; then
        print_skip "Skipping - no access token available"
        return
    fi
    
    local payload='{
  "labelResponseOptions": "LABEL",
  "requestedShipment": {
    "shipper": {
      "contact": {
        "personName": "Test Shipper",
        "phoneNumber": "5551234567"
      },
      "address": {
        "streetLines": ["1202 Chalet Ln"],
        "city": "Harrison",
        "stateOrProvinceCode": "AR",
        "postalCode": "72601",
        "countryCode": "US"
      }
    },
    "recipients": [{
      "contact": {
        "personName": "Test Recipient",
        "phoneNumber": "5559876543"
      },
      "address": {
        "streetLines": ["123 Main St"],
        "city": "Memphis",
        "stateOrProvinceCode": "TN",
        "postalCode": "38101",
        "countryCode": "US"
      }
    }],
    "serviceType": "FEDEX_GROUND",
    "packagingType": "YOUR_PACKAGING",
    "pickupType": "USE_SCHEDULED_PICKUP",
    "shippingChargesPayment": {
      "paymentType": "SENDER",
      "payor": {
        "responsibleParty": {
          "accountNumber": {
            "value": "'${FEDEX_SHIPPER_ACCOUNT:-${FEDEX_ACCOUNT_NUMBER}}'"
          }
        }
      }
    },
    "labelSpecification": {
      "labelFormatType": "COMMON2D",
      "imageType": "PDF",
      "labelStockType": "PAPER_4X6"
    },
    "requestedPackageLineItems": [{
      "weight": {
        "units": "KG",
        "value": 1.0
      }
    }]
  },
  "accountNumber": {
    "value": "'${FEDEX_ACCOUNT_NUMBER}'"
  }
}'
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "${FEDEX_API_URL}/ship/v1/shipments" \
        -H "Authorization: Bearer ${FEDEX_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" == "200" ]; then
        local tracking_number=$(echo "$body" | grep -o '"trackingNumber":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ -n "$tracking_number" ]; then
            print_success "Shipment created successfully"
            echo "  Tracking Number: $tracking_number"
            export TEST_TRACKING_NUMBER="$tracking_number"
            return 0
        else
            print_failure "Shipment response missing tracking number"
            echo "  Response: ${body:0:200}..."
            return 1
        fi
    else
        print_failure "Shipment creation failed (HTTP $status)"
        echo "  Response: ${body:0:200}..."
        return 1
    fi
}

test_tracking() {
    print_test "Testing tracking lookup"
    
    if [ -z "$FEDEX_ACCESS_TOKEN" ]; then
        print_skip "Skipping - no access token available"
        return
    fi
    
    # Use test tracking number or a known valid sandbox tracking number
    local tracking_num="${TEST_TRACKING_NUMBER:-794644790138}"
    
    local payload='{
  "includeDetailedScans": true,
  "trackingInfo": [{
    "trackingNumberInfo": {
      "trackingNumber": "'$tracking_num'"
    }
  }]
}'
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "${FEDEX_API_URL}/track/v1/trackingnumbers" \
        -H "Authorization: Bearer ${FEDEX_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" == "200" ]; then
        local found=$(echo "$body" | grep -c "trackingNumber" || true)
        if [ "$found" -gt 0 ]; then
            print_success "Tracking information retrieved successfully"
            echo "  Tracking Number: $tracking_num"
            return 0
        else
            print_failure "Tracking response missing data"
            echo "  Response: ${body:0:200}..."
            return 1
        fi
    else
        # Tracking not found is acceptable for new tracking numbers
        if echo "$body" | grep -q "TRACKING.TRACKINGNUMBER.NOTFOUND"; then
            print_success "Tracking API working (tracking number not found yet)"
            return 0
        else
            print_failure "Tracking lookup failed (HTTP $status)"
            echo "  Response: ${body:0:200}..."
            return 1
        fi
    fi
}

test_rate_quotes() {
    print_test "Testing rate quote retrieval"
    
    if [ -z "$FEDEX_ACCESS_TOKEN" ]; then
        print_skip "Skipping - no access token available"
        return
    fi
    
    local payload='{
  "accountNumber": {
    "value": "'${FEDEX_ACCOUNT_NUMBER}'"
  },
  "requestedShipment": {
    "shipper": {
      "address": {
        "postalCode": "72601",
        "countryCode": "US"
      }
    },
    "recipient": {
      "address": {
        "postalCode": "38101",
        "countryCode": "US"
      }
    },
    "pickupType": "USE_SCHEDULED_PICKUP",
    "rateRequestType": ["LIST"],
    "requestedPackageLineItems": [{
      "weight": {
        "units": "KG",
        "value": 1.0
      }
    }]
  }
}'
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "${FEDEX_API_URL}/rate/v1/rates/quotes" \
        -H "Authorization: Bearer ${FEDEX_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" == "200" ]; then
        local rates=$(echo "$body" | grep -c "serviceType" || true)
        if [ "$rates" -gt 0 ]; then
            print_success "Rate quotes retrieved successfully"
            echo "  Found $rates service options"
            return 0
        else
            print_failure "Rate response missing service types"
            echo "  Response: ${body:0:200}..."
            return 1
        fi
    else
        print_failure "Rate quote request failed (HTTP $status)"
        echo "  Response: ${body:0:200}..."
        return 1
    fi
}

test_error_handling() {
    print_test "Testing error handling"
    
    if [ -z "$FEDEX_ACCESS_TOKEN" ]; then
        print_skip "Skipping - no access token available"
        return
    fi
    
    # Test with invalid tracking number
    local payload='{"trackingInfo": [{"trackingNumberInfo": {"trackingNumber": "INVALID"}}]}'
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "${FEDEX_API_URL}/track/v1/trackingnumbers" \
        -H "Authorization: Bearer ${FEDEX_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    # Should get an error response
    if echo "$body" | grep -q "error"; then
        print_success "Error handling working correctly"
        return 0
    else
        print_failure "Expected error response for invalid input"
        echo "  Response: ${body:0:200}..."
        return 1
    fi
}

###############################################################################
# Main
###############################################################################

main() {
    print_header "FedEx Integration Test Suite"
    
    echo "Testing against: ${FEDEX_API_URL}"
    echo "Account: ${FEDEX_ACCOUNT_NUMBER}"
    echo ""
    
    # Check environment variables
    check_env_vars
    
    # Run tests
    test_oauth_token
    test_create_shipment
    test_tracking
    test_rate_quotes
    test_error_handling
    
    # Print summary
    print_header "Test Results"
    echo -e "${GREEN}Passed:  ${TESTS_PASSED}${NC}"
    echo -e "${RED}Failed:  ${TESTS_FAILED}${NC}"
    echo -e "${YELLOW}Skipped: ${TESTS_SKIPPED}${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        exit 1
    fi
}

main "$@"
