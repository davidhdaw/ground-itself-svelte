#!/bin/bash

# Script to export the mkcert root CA for installation on mobile devices

echo "Exporting mkcert root CA for mobile device installation..."
echo ""

# Get the CA root directory
CA_ROOT=$(mkcert -CAROOT 2>/dev/null)

if [ -z "$CA_ROOT" ] || [ ! -d "$CA_ROOT" ]; then
    echo "❌ Error: mkcert CA root not found"
    echo "   Make sure mkcert is installed and run 'mkcert -install' first"
    exit 1
fi

ROOT_CA_FILE="$CA_ROOT/rootCA.pem"

if [ ! -f "$ROOT_CA_FILE" ]; then
    echo "❌ Error: rootCA.pem not found at $ROOT_CA_FILE"
    exit 1
fi

# Create a directory for exported CA
mkdir -p certs/export

# Copy the root CA
cp "$ROOT_CA_FILE" certs/export/rootCA.pem

echo "✅ Root CA exported to: certs/export/rootCA.pem"
echo ""
echo "📱 Installation instructions:"
echo ""
echo "iOS:"
echo "  1. Transfer certs/export/rootCA.pem to your iPhone (AirDrop, email, etc.)"
echo "  2. Open the file on iPhone"
echo "  3. Go to Settings → General → VPN & Device Management"
echo "  4. Tap the certificate and install it"
echo "  5. Go to Settings → General → About → Certificate Trust Settings"
echo "  6. Enable 'Full Trust' for the mkcert root certificate"
echo ""
echo "Android:"
echo "  1. Transfer certs/export/rootCA.pem to your Android device"
echo "  2. Go to Settings → Security → Install from storage"
echo "  3. Select the certificate file"
echo "  4. Name it 'mkcert' and set type to 'VPN and apps'"
echo ""
echo "After installing, restart your mobile browser and try accessing the dev server again."
