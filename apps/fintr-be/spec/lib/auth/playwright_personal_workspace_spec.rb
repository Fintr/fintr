# frozen_string_literal: true

require "rails_helper"

RSpec.describe Auth::PlaywrightPersonalWorkspace do
  around do |example|
    original_email = ENV["E2E_PERSONAL_EMAIL"]
    original_password = ENV["E2E_PERSONAL_PASSWORD"]
    ENV.delete("E2E_PERSONAL_EMAIL")
    ENV.delete("E2E_PERSONAL_PASSWORD")
    example.run
  ensure
    ENV["E2E_PERSONAL_EMAIL"] = original_email
    ENV["E2E_PERSONAL_PASSWORD"] = original_password
  end

  describe ".email" do
    it "defaults to the personal workspace owner" do
      expect(described_class.email).to eq("miguel.dagatan@gmail.com")
    end
  end

  describe ".password" do
    it "defaults to the documented Playwright password" do
      expect(described_class.password).to eq("FintrPlaywright!Personal2026")
    end
  end
end
