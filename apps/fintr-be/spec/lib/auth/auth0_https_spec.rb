# frozen_string_literal: true

require "rails_helper"

RSpec.describe Auth::Auth0Https do
  describe ".open" do
    let(:uri) { URI("https://tenant.example.auth0.com/oauth/token") }
    let(:http) { instance_double(Net::HTTP) }

    before do
      allow(Net::HTTP).to receive(:new).and_return(http)
      allow(http).to receive(:use_ssl=)
      allow(http).to receive(:open_timeout=)
      allow(http).to receive(:read_timeout=)
      allow(http).to receive(:ipaddr=)
      allow(Socket).to receive(:getaddrinfo).and_return(
        [
          [
            "AF_INET",
            0,
            "tenant.example.auth0.com",
            "1.2.3.4",
          ],
        ]
      )
    end

    it "caps how long the TCP connect may block" do
      described_class.open(uri)

      expect(http).to have_received(:open_timeout=).with(5)
    end

    it "caps how long a response may take" do
      described_class.open(uri)

      expect(http).to have_received(:read_timeout=).with(10)
    end

    it "connects to the IPv4 address so a blackholed IPv6 route cannot stall login" do
      described_class.open(uri)

      expect(http).to have_received(:ipaddr=).with("1.2.3.4")
    end

    it "still opens when no IPv4 address is available" do
      allow(Socket).to receive(:getaddrinfo).and_raise(SocketError)

      described_class.open(uri)

      expect(http).not_to have_received(:ipaddr=)
    end
  end
end
