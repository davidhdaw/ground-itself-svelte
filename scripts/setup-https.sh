#!/bin/bash

# Setup script for HTTPS local development
# This script helps set up mkcert for local SSL certificates

echo "Setting up HTTPS for local development..."

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "mkcert is not installed."
    echo ""
    echo "To install mkcert:"
    echo "  macOS: brew install mkcert"
    echo "  Linux: Follow instructions at https://github.com/FiloSottile/mkcert"
    echo "  Windows: choco install mkcert"
    echo ""
    echo "After installing mkcert, run:"
    echo "  mkcert -install"
    echo "  mkcert localhost 127.0.0.1 ::1"
    echo ""
    exit 1
fi

# Create certs directory if it doesn't exist
mkdir -p certs

# Install local CA (if not already installed)
echo "Installing local CA..."
echo "This may require your password (one-time setup)..."
if ! mkcert -install 2>/dev/null; then
    echo ""
    echo "⚠️  Failed to install CA. This usually means:"
    echo "   1. You need to run 'mkcert -install' manually first (requires password)"
    echo "   2. Or the CA is already installed"
    echo ""
    echo "Trying to continue with certificate generation..."
    echo ""
fi

# Detect local IP address for mobile access
LOCAL_IP=""
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - try common network interfaces
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - try common network interfaces
    LOCAL_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -n1)
fi

# Build list of domains/IPs for certificate
DOMAINS=("localhost" "127.0.0.1" "::1")

if [ -n "$LOCAL_IP" ]; then
    echo "Detected local IP: $LOCAL_IP"
    DOMAINS+=("$LOCAL_IP")
else
    echo "⚠️  Could not automatically detect local IP address"
    echo "   Certificates will work for localhost only"
    echo "   For mobile access, you may need to regenerate with your IP:"
    echo "   mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost 127.0.0.1 ::1 YOUR_LOCAL_IP"
fi

# Generate certificates
echo "Generating SSL certificates for: ${DOMAINS[*]}"
mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem "${DOMAINS[@]}"

echo ""
echo "✅ HTTPS setup complete!"
echo "Certificates are in the ./certs directory"
echo ""
if [ -n "$LOCAL_IP" ]; then
    echo "📱 To access from mobile device on the same network:"
    echo "   https://$LOCAL_IP:5173"
    echo ""
fi
echo "Start your dev server with: npm run dev"
echo "The server will automatically use HTTPS if certificates are present."
