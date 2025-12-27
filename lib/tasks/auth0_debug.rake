# frozen_string_literal: true

namespace :auth0 do
  desc "Debug Auth0 M2M connection"
  task debug_m2m: :environment do
    puts "=" * 80
    puts "Auth0 M2M Connection Debug"
    puts "=" * 80

    # Check environment variables
    puts "\n1. Checking environment variables:"
    puts "   M2M_AUTH0_CLIENT_ID: #{ENV['M2M_AUTH0_CLIENT_ID'].present? ? '✓ Set' : '✗ Missing'}"
    puts "   M2M_AUTH0_CLIENT_SECRET: #{ENV['M2M_AUTH0_CLIENT_SECRET'].present? ? '✓ Set' : '✗ Missing'}"
    puts "   M2M_AUTH0_DOMAIN: #{ENV['M2M_AUTH0_DOMAIN'] || '✗ Missing'}"

    # Test M2M client creation
    puts "\n2. Testing M2M client creation:"
    begin
      client = Auth::M2mClient.client
      puts "   ✓ M2M client created successfully"
    rescue => e
      puts "   ✗ Failed to create M2M client: #{e.message}"
      exit 1
    end

    # Test a simple API call (get users)
    puts "\n3. Testing Auth0 Management API access:"
    begin
      # Try to get the first user (limit 1) to test API access
      users = client.users(per_page: 1)
      puts "   ✓ Successfully accessed Auth0 Management API"
      puts "   Retrieved #{users.length} user(s) from Auth0"
    rescue Auth0::Unauthorized => e
      puts "   ✗ Unauthorized - Token is invalid or expired"
      puts "   Error: #{e.message}"
      puts "\n   Trying to reset M2M client and retry..."

      begin
        Auth::M2mClient.reset!
        client = Auth::M2mClient.client
        users = client.users(per_page: 1)
        puts "   ✓ Success after reset! Retrieved #{users.length} user(s)"
      rescue => retry_error
        puts "   ✗ Still failing after reset: #{retry_error.message}"
        exit 1
      end
    rescue => e
      puts "   ✗ API call failed: #{e.class} - #{e.message}"
      exit 1
    end

    # Test updating a user (find a test user first)
    puts "\n4. Testing user update capability:"
    begin
      # Find first user with auth0 authentication
      test_user = Auth::User.where("auth_id LIKE ?", "auth0|%").first

      if test_user
        puts "   Found test user: #{test_user.email}"

        # Try to get user details from Auth0
        auth0_user = client.user(test_user.auth_id)
        puts "   ✓ Successfully retrieved user from Auth0"
        puts "   Current name: #{auth0_user['name']}"
        puts "   Current email: #{auth0_user['email']}"

        puts "\n   Note: Not actually updating user (dry run only)"
      else
        puts "   ⚠ No test user found with auth0| authentication"
      end
    rescue => e
      puts "   ✗ User lookup/update test failed: #{e.class} - #{e.message}"
    end

    puts "\n" + "=" * 80
    puts "Debug complete!"
    puts "=" * 80
  end

  desc "Reset M2M client token"
  task reset_m2m: :environment do
    puts "Resetting Auth0 M2M client..."
    Auth::M2mClient.reset!
    puts "✓ M2M client reset. Next API call will get a fresh token."
  end
end
