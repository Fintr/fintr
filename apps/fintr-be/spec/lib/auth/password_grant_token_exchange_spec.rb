# frozen_string_literal: true

require "rails_helper"

RSpec.describe Auth::PasswordGrantTokenExchange do
  describe ".call" do
    let(:http) { instance_double(Net::HTTP) }
    let(:response) { Net::HTTPSuccess.new("1.1", "200", "OK") }

    before do
      allow(Auth::PasswordGrantCredentials).to receive(:configured?).and_return(true)
      allow(Auth::PasswordGrantCredentials).to receive(:fetch).and_return(
        auth0_domain: "tenant.example.auth0.com",
        client_id: "client-id",
        client_secret: "client-secret",
        audience: "https://api.example.com"
      )
      allow(response).to receive(:body).and_return(
        {
          access_token: "access",
          id_token: "id-token",
          expires_in: 3600,
          token_type: "Bearer",
          scope: "openid"
        }.to_json
      )
      allow(Auth::Auth0Https).to receive(:open).and_return(http)
      allow(http).to receive(:request).and_return(response)
    end

    it "reaches Auth0 through the fast HTTPS client" do
      described_class.call(
        username: "user@example.com",
        password: "secret"
      )

      expect(Auth::Auth0Https).to have_received(:open).with(
        URI("https://tenant.example.auth0.com/oauth/token")
      )
    end
  end
end
