# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::E2e::TestSetup", type: :request do
  let(:user) do
    create(
      :user,
      email: "miguel.dagatan@gmail.com",
      auth_id: "google-oauth2|e2e-personal"
    )
  end
  let(:space) do
    create(
      :personal_space,
      code: "miguel-dagatan-gmail-com-personal-space",
      owner: user
    )
  end

  before do
    create(:space_user, user:, space:)
  end

  describe "POST /api/v1/e2e/setup" do
    it "returns the personal workspace user in development" do
      post "/api/v1/e2e/setup"

      expect(response).to have_http_status(:ok)
    end

    it "includes the personal workspace space code" do
      post "/api/v1/e2e/setup"

      expect(JSON.parse(response.body)["space_code"]).to eq(space.code)
    end

    it "includes the personal workspace user id" do
      post "/api/v1/e2e/setup"

      expect(JSON.parse(response.body)["user_id"]).to eq(user.id)
    end

    it "returns not found outside development and test" do
      allow(Rails.env).to receive(:development?).and_return(false)
      allow(Rails.env).to receive(:test?).and_return(false)

      post "/api/v1/e2e/setup"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/e2e/reset" do
    it "does not wipe personal workspace data" do
      post "/api/v1/e2e/reset"

      expect(JSON.parse(response.body)["message"]).to include("disabled")
    end
  end
end
