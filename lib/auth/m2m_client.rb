# frozen_string_literal: true

module Auth
  class M2mClient
    def self.client
      @client ||= Auth0Client.new(
        client_id: ENV["M2M_AUTH0_CLIENT_ID"],
        client_secret: ENV["M2M_AUTH0_CLIENT_SECRET"],
        domain: ENV["M2M_AUTH0_DOMAIN"]
      )
    end
  end
end
