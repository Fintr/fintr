# frozen_string_literal: true

require "rails_helper"

RSpec.describe Integrations::Revenuecat::Client do
  subject(:client) { described_class.new(api_key: "secret_v2", project_id: "proj_123") }

  it "sends a bearer token to the v2 customer endpoint" do
    http = instance_double(Net::HTTP)
    response = Net::HTTPSuccess.new("1.1", "200", "OK")
    allow(response).to receive(:body).and_return({ object: "customer", id: "user-1" }.to_json)
    allow(Net::HTTP).to receive(:new).and_return(http)
    allow(http).to receive(:use_ssl=)
    allow(http).to receive(:read_timeout=)
    allow(http).to receive(:open_timeout=)
    captured = nil
    allow(http).to receive(:request) do |request|
      captured = request
      response
    end

    body = client.get_customer(customer_id: "user 1")

    expect(captured["Authorization"]).to eq("Bearer secret_v2")
    expect(captured.uri.path).to eq("/v2/projects/proj_123/customers/user%201")
    expect(body["object"]).to eq("customer")
  end

  it "raises not found when RevenueCat has no customer" do
    http = instance_double(Net::HTTP)
    response = Net::HTTPNotFound.new("1.1", "404", "Not Found")
    allow(response).to receive(:body).and_return({ type: "resource_missing", message: "not found" }.to_json)
    allow(Net::HTTP).to receive(:new).and_return(http)
    allow(http).to receive(:use_ssl=)
    allow(http).to receive(:read_timeout=)
    allow(http).to receive(:open_timeout=)
    allow(http).to receive(:request).and_return(response)

    expect { client.get_customer(customer_id: "missing") }.to raise_error(Integrations::Revenuecat::NotFound)
  end
end
