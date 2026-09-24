# frozen_string_literal: true

require "rails_helper"

RSpec.describe Auth::User, ".attributes_from_token_claims" do
  it "maps Auth0 picture to photo_url" do
    attrs = described_class.attributes_from_token_claims(
      "sub" => "auth0|123",
      "email" => "miko@example.com",
      "name" => "Miko Dagatan",
      "picture" => "https://example.com/miko.jpg",
    )

    expect(attrs).to eq(
      auth_id: "auth0|123",
      email: "miko@example.com",
      full_name: "Miko Dagatan",
      photo_url: "https://example.com/miko.jpg",
    )
  end

  it "prefers full_name over name" do
    attrs = described_class.attributes_from_token_claims(
      "sub" => "auth0|123",
      "full_name" => "Preferred Name",
      "name" => "Fallback Name",
    )

    expect(attrs[:full_name]).to eq("Preferred Name")
  end
end
