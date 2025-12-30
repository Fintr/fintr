# Creating a Certificate Signing Request (CSR) for Apple Developer

## Quick Method (Command Line)

1. Open Terminal and run:

```bash
# Create a directory for your CSR
mkdir ~/Desktop/Apple_CSR
cd ~/Desktop/Apple_CSR

# Generate private key
openssl genrsa -out privateKey.key 2048

# Create CSR (replace with your info)
openssl req -new -key privateKey.key -out CertificateSigningRequest.certSigningRequest \
    -subj "/emailAddress=your.email@example.com, CN=Your Name, C=US"
```

Replace:
- `your.email@example.com` with your Apple ID email
- `Your Name` with your name (e.g., "Joel Paolo Paraiso")
- `C=US` with your 2-letter country code (US, PH, JP, etc.)

## Alternative: Modern Keychain Access Method

If Keychain Access is available on your Mac:

1. Open **Keychain Access** (Press Cmd+Space, type "Keychain Access")
2. Go to menu: **Keychain Access** → **Certificate Assistant** → **Request a Certificate from a Certificate Authority**
3. Fill in:
   - **User Email Address**: Your Apple ID email
   - **Common Name**: Your name
   - **CA Email Address**: Leave empty
   - Select **"Saved to disk"**
4. Click **Continue** and save the file

## After Creating the CSR

1. Go to https://developer.apple.com/account/resources/certificates/list
2. Click **"+"** button
3. Select **"Apple Distribution"** → Continue
4. Upload your `CertificateSigningRequest.certSigningRequest` file
5. Download the certificate and double-click to install it in Keychain

## Important Notes

- **Keep your private key safe!** You'll need it for code signing
- The CSR file can be uploaded to Apple
- After installing the certificate, you can create provisioning profiles

