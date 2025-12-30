#!/bin/bash
set -e

echo "🔐 Creating Certificate Signing Request (CSR)"
echo "============================================="
echo ""

# Get user information
read -p "Enter your email address: " EMAIL
read -p "Enter your name (e.g., Joel Paolo Paraiso): " NAME
read -p "Enter your country code (2 letters, e.g., US, PH, JP): " COUNTRY

# Create a directory for the CSR
CSR_DIR="$HOME/Desktop/CSR_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$CSR_DIR"
cd "$CSR_DIR"

echo ""
echo "📝 Generating private key and CSR..."
echo ""

# Generate private key (RSA 2048 bit - standard for Apple certificates)
openssl genrsa -out privateKey.key 2048

# Create CSR
openssl req -new -key privateKey.key -out CertificateSigningRequest.certSigningRequest \
    -subj "/emailAddress=$EMAIL, CN=$NAME, C=$COUNTRY"

echo ""
echo "✅ CSR created successfully!"
echo ""
echo "📁 Files created in: $CSR_DIR"
echo "   - privateKey.key (KEEP THIS SECRET - you'll need it later)"
echo "   - CertificateSigningRequest.certSigningRequest (upload this to Apple)"
echo ""
echo "📤 Next steps:"
echo "   1. Go to: https://developer.apple.com/account/resources/certificates/list"
echo "   2. Click '+' to create a new certificate"
echo "   3. Select 'Apple Distribution'"
echo "   4. Upload the file: $CSR_DIR/CertificateSigningRequest.certSigningRequest"
echo "   5. Download the certificate and double-click to install it"
echo ""
echo "⚠️  IMPORTANT: Keep the privateKey.key file safe! You'll need it for signing."
echo ""

