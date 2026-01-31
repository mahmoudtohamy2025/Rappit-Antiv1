#!/bin/bash

###############################################################################
# FedEx Admin CLI Tool
#
# Command-line interface for managing and testing FedEx integration
#
# Usage:
#   ./scripts/fedex-admin.sh <command> [args]
#
# Commands:
#   test-auth                    - Test OAuth authentication
#   create-test-shipment         - Create a test shipment
#   track <tracking_number>      - Track a shipment
#   cancel <tracking_number>     - Cancel a shipment
#   get-rates <from_zip> <to_zip> <weight_kg> - Get rate quotes
#   show-stats                   - Display integration statistics
#   show-errors                  - Display recent errors
#   help                         - Show this help message
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Load environment
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

get_access_token() {
    if [ -z "$FEDEX_ACCESS_TOKEN" ]; then
        print_info "Obtaining access token..."
        
        local response=$(curl -s -X POST \
            "${FEDEX_API_URL}/oauth/token" \
            -H "Content-Type: application/x-www-form-urlencoded" \
            -d "grant_type=client_credentials&client_id=${FEDEX_API_KEY}&client_secret=${FEDEX_SECRET_KEY}")
        
        export FEDEX_ACCESS_TOKEN=$(echo "$response" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
        
        if [ -z "$FEDEX_ACCESS_TOKEN" ]; then
            print_error "Failed to obtain access token"
            echo "Response: $response"
            exit 1
        fi
        
        print_success "Access token obtained"
    fi
}

###############################################################################
# Commands
###############################################################################

cmd_test_auth() {
    print_header "Testing FedEx OAuth Authentication"
    
    print_info "API URL: ${FEDEX_API_URL}"
    print_info "Account: ${FEDEX_ACCOUNT_NUMBER}"
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "${FEDEX_API_URL}/oauth/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=client_credentials&client_id=${FEDEX_API_KEY}&client_secret=${FEDEX_SECRET_KEY}")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" == "200" ]; then
        local access_token=$(echo "$body" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
        local expires_in=$(echo "$body" | grep -o '"expires_in":[0-9]*' | cut -d':' -f2)
        
        print_success "Authentication successful!"
        echo ""
        echo "Access Token: ${access_token:0:30}..."
        echo "Expires In: ${expires_in} seconds"
        echo "Token Type: bearer"
    else
        print_error "Authentication failed (HTTP $status)"
        echo ""
        echo "Response:"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        exit 1
    fi
}

cmd_create_test_shipment() {
    print_header "Creating Test Shipment"
    
    get_access_token
    
    local payload='{
  "labelResponseOptions": "LABEL",
  "requestedShipment": {
    "shipper": {
      "contact": {
        "personName": "'${FEDEX_SHIPPER_NAME:-Test Shipper}'",
        "phoneNumber": "'${FEDEX_SHIPPER_PHONE:-5551234567}'"
      },
      "address": {
        "streetLines": ["'${FEDEX_SHIPPER_STREET:-1202 Chalet Ln}'"],
        "city": "'${FEDEX_SHIPPER_CITY:-Harrison}'",
        "stateOrProvinceCode": "'${FEDEX_SHIPPER_STATE:-AR}'",
        "postalCode": "'${FEDEX_SHIPPER_POSTAL_CODE:-72601}'",
        "countryCode": "'${FEDEX_SHIPPER_COUNTRY:-US}'"
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
    
    print_info "Creating shipment..."
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "${FEDEX_API_URL}/ship/v1/shipments" \
        -H "Authorization: Bearer ${FEDEX_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" == "200" ]; then
        print_success "Shipment created successfully!"
        echo ""
        
        local tracking=$(echo "$body" | grep -o '"trackingNumber":"[^"]*"' | head -1 | cut -d'"' -f4)
        local service=$(echo "$body" | grep -o '"serviceType":"[^"]*"' | head -1 | cut -d'"' -f4)
        
        echo "Tracking Number: $tracking"
        echo "Service Type: $service"
        echo ""
        echo "Full response:"
        echo "$body" | jq '.output.transactionShipments[0] | {trackingNumber: .masterTrackingNumber, serviceType: .serviceType}' 2>/dev/null || echo "$body"
    else
        print_error "Shipment creation failed (HTTP $status)"
        echo ""
        echo "Response:"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        exit 1
    fi
}

cmd_track() {
    local tracking_number="$1"
    
    if [ -z "$tracking_number" ]; then
        print_error "Tracking number required"
        echo "Usage: $0 track <tracking_number>"
        exit 1
    fi
    
    print_header "Tracking Shipment: $tracking_number"
    
    get_access_token
    
    local payload='{
  "includeDetailedScans": true,
  "trackingInfo": [{
    "trackingNumberInfo": {
      "trackingNumber": "'$tracking_number'"
    }
  }]
}'
    
    print_info "Fetching tracking information..."
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "${FEDEX_API_URL}/track/v1/trackingnumbers" \
        -H "Authorization: Bearer ${FEDEX_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" == "200" ]; then
        print_success "Tracking information retrieved!"
        echo ""
        echo "$body" | jq '.output.completeTrackResults[0].trackResults[0] | {trackingNumber: .trackingNumberInfo.trackingNumber, status: .latestStatusDetail.statusByLocale, events: .scanEvents | length}' 2>/dev/null || echo "$body"
    else
        if echo "$body" | grep -q "TRACKING.TRACKINGNUMBER.NOTFOUND"; then
            print_error "Tracking number not found"
            print_info "Note: New tracking numbers may take 30 minutes to appear in the system"
        else
            print_error "Tracking lookup failed (HTTP $status)"
        fi
        echo ""
        echo "Response:"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        exit 1
    fi
}

cmd_cancel() {
    local tracking_number="$1"
    
    if [ -z "$tracking_number" ]; then
        print_error "Tracking number required"
        echo "Usage: $0 cancel <tracking_number>"
        exit 1
    fi
    
    print_header "Cancelling Shipment: $tracking_number"
    
    get_access_token
    
    local payload='{
  "accountNumber": {
    "value": "'${FEDEX_ACCOUNT_NUMBER}'"
  },
  "trackingNumber": "'$tracking_number'"
}'
    
    print_info "Cancelling shipment..."
    
    local response=$(curl -s -w "\n%{http_code}" -X PUT \
        "${FEDEX_API_URL}/ship/v1/shipments/cancel" \
        -H "Authorization: Bearer ${FEDEX_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" == "200" ]; then
        print_success "Shipment cancelled successfully!"
        echo ""
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        print_error "Cancellation failed (HTTP $status)"
        echo ""
        echo "Response:"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        exit 1
    fi
}

cmd_get_rates() {
    local from_zip="${1:-72601}"
    local to_zip="${2:-38101}"
    local weight="${3:-1.0}"
    
    print_header "Getting Rate Quotes"
    
    print_info "From: $from_zip"
    print_info "To: $to_zip"
    print_info "Weight: $weight kg"
    
    get_access_token
    
    local payload='{
  "accountNumber": {
    "value": "'${FEDEX_ACCOUNT_NUMBER}'"
  },
  "requestedShipment": {
    "shipper": {
      "address": {
        "postalCode": "'$from_zip'",
        "countryCode": "US"
      }
    },
    "recipient": {
      "address": {
        "postalCode": "'$to_zip'",
        "countryCode": "US"
      }
    },
    "pickupType": "USE_SCHEDULED_PICKUP",
    "rateRequestType": ["LIST"],
    "requestedPackageLineItems": [{
      "weight": {
        "units": "KG",
        "value": '$weight'
      }
    }]
  }
}'
    
    print_info "Fetching rates..."
    
    local response=$(curl -s -w "\n%{http_code}" -X POST \
        "${FEDEX_API_URL}/rate/v1/rates/quotes" \
        -H "Authorization: Bearer ${FEDEX_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local body=$(echo "$response" | head -n -1)
    local status=$(echo "$response" | tail -n 1)
    
    if [ "$status" == "200" ]; then
        print_success "Rate quotes retrieved!"
        echo ""
        echo "$body" | jq '.output.rateReplyDetails[] | {service: .serviceType, cost: .ratedShipmentDetails[0].totalNetCharge, currency: .ratedShipmentDetails[0].currency}' 2>/dev/null || echo "$body"
    else
        print_error "Rate quote request failed (HTTP $status)"
        echo ""
        echo "Response:"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        exit 1
    fi
}

cmd_show_stats() {
    print_header "FedEx Integration Statistics"
    
    if ! command -v psql &> /dev/null; then
        print_error "psql not found. Please install PostgreSQL client."
        exit 1
    fi
    
    print_info "Last 24 hours:"
    psql "${DATABASE_URL}" -c "
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed,
          ROUND(100.0 * SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate,
          ROUND(AVG(duration_ms)::numeric, 2) as avg_duration_ms
        FROM integration_logs
        WHERE integration_type = 'FEDEX'
          AND created_at > NOW() - INTERVAL '24 hours';
    "
    
    echo ""
    print_info "By endpoint (last 24 hours):"
    psql "${DATABASE_URL}" -c "
        SELECT 
          endpoint,
          COUNT(*) as requests,
          SUM(CASE WHEN error_message IS NULL THEN 1 ELSE 0 END) as successful
        FROM integration_logs
        WHERE integration_type = 'FEDEX'
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY endpoint
        ORDER BY requests DESC;
    "
}

cmd_show_errors() {
    print_header "Recent FedEx Errors"
    
    if ! command -v psql &> /dev/null; then
        print_error "psql not found. Please install PostgreSQL client."
        exit 1
    fi
    
    psql "${DATABASE_URL}" -c "
        SELECT 
          id,
          endpoint,
          status_code,
          LEFT(error_message, 80) as error,
          created_at
        FROM integration_logs
        WHERE integration_type = 'FEDEX'
          AND error_message IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 20;
    "
}

cmd_help() {
    cat << EOF
FedEx Admin CLI Tool

Usage:
  $0 <command> [args]

Commands:
  test-auth                          Test OAuth authentication
  create-test-shipment               Create a test shipment
  track <tracking_number>            Track a shipment
  cancel <tracking_number>           Cancel a shipment
  get-rates <from_zip> <to_zip> <weight_kg>  Get rate quotes
  show-stats                         Display integration statistics
  show-errors                        Display recent errors
  help                               Show this help message

Examples:
  $0 test-auth
  $0 create-test-shipment
  $0 track 794644790138
  $0 get-rates 72601 38101 1.5
  $0 show-stats

Environment Variables:
  FEDEX_API_KEY          FedEx API Key
  FEDEX_SECRET_KEY       FedEx Secret Key
  FEDEX_ACCOUNT_NUMBER   FedEx Account Number
  FEDEX_API_URL          FedEx API URL (sandbox or production)
  DATABASE_URL           Database connection string (for stats)

EOF
}

###############################################################################
# Main
###############################################################################

main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        test-auth)
            cmd_test_auth
            ;;
        create-test-shipment)
            cmd_create_test_shipment
            ;;
        track)
            cmd_track "$@"
            ;;
        cancel)
            cmd_cancel "$@"
            ;;
        get-rates)
            cmd_get_rates "$@"
            ;;
        show-stats)
            cmd_show_stats
            ;;
        show-errors)
            cmd_show_errors
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
