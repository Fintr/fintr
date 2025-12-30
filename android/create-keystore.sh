#!/bin/bash
set -e

echo "🔐 Creating Android Keystore"
echo "=============================="
echo ""

KEYSTORE_PATH="app/fintr-release-key.jks"
KEYSTORE_PROPERTIES="keystore.properties"

# Check if keystore already exists
if [ -f "$KEYSTORE_PATH" ]; then
    echo "⚠️  Keystore already exists at: $KEYSTORE_PATH"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo "Please provide the following information for your keystore:"
echo ""

# Get keystore details
read -p "Keystore password: " -s KEYSTORE_PASSWORD
echo ""
read -p "Key alias (default: fintr-key): " KEY_ALIAS
KEY_ALIAS=${KEY_ALIAS:-fintr-key}
read -p "Key password (default: same as keystore): " -s KEY_PASSWORD
echo ""
KEY_PASSWORD=${KEY_PASSWORD:-$KEYSTORE_PASSWORD}

read -p "Your name (for certificate): " CERT_NAME
read -p "Your organization (for certificate): " CERT_ORG
read -p "Your city (for certificate): " CERT_CITY
read -p "Your state/province (for certificate): " CERT_STATE
read -p "Your country code (2 letters, e.g., US): " CERT_COUNTRY

echo ""
echo "Creating keystore..."

# Create keystore using keytool
keytool -genkeypair \
    -v \
    -storetype PKCS12 \
    -keystore "$KEYSTORE_PATH" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEY_PASSWORD" \
    -dname "CN=$CERT_NAME, OU=$CERT_ORG, L=$CERT_CITY, ST=$CERT_STATE, C=$CERT_COUNTRY"

echo ""
echo "✅ Keystore created successfully!"
echo ""

# Create or update keystore.properties
cat > "$KEYSTORE_PROPERTIES" << EOF
storeFile=fintr-release-key.jks
storePassword=$KEYSTORE_PASSWORD
keyAlias=$KEY_ALIAS
keyPassword=$KEY_PASSWORD
EOF

echo "✅ Created $KEYSTORE_PROPERTIES"
echo ""
echo "⚠️  IMPORTANT: Keep your keystore and passwords safe!"
echo "   - If you lose the keystore, you cannot update your app on Google Play"
echo "   - Store a backup in a secure location"
echo "   - The keystore.properties file has been created (already in .gitignore)"
echo ""
echo "📦 Keystore location: $KEYSTORE_PATH"
echo "📝 Properties file: $KEYSTORE_PROPERTIES"
echo ""
echo "You can now build signed APKs using:"
echo "  ./gradlew assembleRelease"
echo "  or"
echo "  ./gradlew bundleRelease"


