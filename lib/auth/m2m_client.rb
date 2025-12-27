# frozen_string_literal: true

module Auth
  class M2mClient
    # Token typically expires after 24 hours
    TOKEN_EXPIRY_BUFFER = 5.minutes

    class << self
      def client
        # Refresh client if token is expired or about to expire
        if @client.nil? || token_expired?
          @client = create_client
          @token_created_at = Time.current
        end

        @client
      end

      private

      def create_client
        Auth0Client.new(
          client_id: ENV["M2M_AUTH0_CLIENT_ID"],
          client_secret: ENV["M2M_AUTH0_CLIENT_SECRET"],
          domain: ENV["M2M_AUTH0_DOMAIN"]
        )
      end

      def token_expired?
        return true if @token_created_at.nil?

        # Refresh token if it's older than 23 hours (Auth0 tokens typically expire after 24 hours)
        Time.current > @token_created_at + 23.hours
      end

      # Allow manual reset if needed
      def reset!
        @client = nil
        @token_created_at = nil
      end
    end
  end
end
