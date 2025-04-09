#!/bin/bash

# Replace with your actual API host
API_HOST="localhost:3000"

# User registration
echo "Testing user registration API..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "email": "test4@example.com",
      "password": "password123",
      "password_confirmation": "password123"
    }
  }' \
  "http://$API_HOST/api/v1/users"

echo -e "\n\nTesting user sign in API..."
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "email": "test@example.com",
      "password": "password123"
    }
  }' \
  "http://$API_HOST/api/v1/users/sign_in" 
