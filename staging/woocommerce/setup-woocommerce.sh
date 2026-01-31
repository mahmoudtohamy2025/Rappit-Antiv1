#!/bin/bash
#
# WooCommerce Auto-Setup Script
# Runs inside WordPress CLI container to configure WooCommerce
#

set -e

echo "Waiting for WordPress to be ready..."
until wp core is-installed --allow-root 2>/dev/null; do
    sleep 5
done

echo "WordPress is ready. Setting up WooCommerce..."

# Install WooCommerce plugin
if ! wp plugin is-installed woocommerce --allow-root; then
    echo "Installing WooCommerce..."
    wp plugin install woocommerce --activate --allow-root
else
    echo "WooCommerce already installed"
    wp plugin activate woocommerce --allow-root 2>/dev/null || true
fi

# Configure WordPress for API access
echo "Configuring REST API..."
wp rewrite structure '/%postname%/' --allow-root
wp rewrite flush --allow-root

# Create sample products
echo "Creating sample products..."
wp wc product create \
    --name="Test Product 1" \
    --type=simple \
    --regular_price=29.99 \
    --sku="TEST-SKU-001" \
    --manage_stock=true \
    --stock_quantity=100 \
    --user=1 \
    --allow-root 2>/dev/null || echo "Product may already exist"

wp wc product create \
    --name="Test Product 2" \
    --type=simple \
    --regular_price=49.99 \
    --sku="TEST-SKU-002" \
    --manage_stock=true \
    --stock_quantity=50 \
    --user=1 \
    --allow-root 2>/dev/null || echo "Product may already exist"

# Enable webhooks
echo "Enabling webhook delivery..."
wp option update woocommerce_webhook_delivery_url "http://rappit-api:3000/webhooks/woocommerce" --allow-root

echo ""
echo "=========================================="
echo "WooCommerce Setup Complete!"
echo "=========================================="
echo ""
echo "Access WooCommerce:"
echo "  Store: http://localhost:8080"
echo "  Admin: http://localhost:8080/wp-admin"
echo ""
echo "Default Admin Credentials:"
echo "  Username: admin"
echo "  Password: (set during WordPress install)"
echo ""
echo "API Keys: Generate at WooCommerce > Settings > Advanced > REST API"
echo ""
