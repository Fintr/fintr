# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Admin::Finance::ProGrants", type: :request do
  let(:admin_user) { create(:user) }
  let(:admin_space) { create(:personal_space) }
  let(:recipient) { create(:user, email: "early@example.com") }

  before do
    create(:space_user, space: admin_space, user: admin_user)
    admin_user.add_role(:admin)
  end

  describe "POST /api/v1/admin/finance/pro_grants" do
    let!(:auth) { setup_authentication(user: admin_user, space: admin_space) }
    let(:headers) { auth[:headers] }

    it "grants one year of Fintr Pro to an existing email" do
      recipient

      post "/api/v1/admin/finance/pro_grants",
           params: { email: "early@example.com" },
           headers: headers

      expect(response).to have_http_status(:created)
      body = response.parsed_body.dig("data", "grant")
      expect(body["email"]).to eq("early@example.com")
      expect(body["acknowledgedAt"]).to be_nil
    end

    it "rejects an unknown email" do
      post "/api/v1/admin/finance/pro_grants",
           params: { email: "missing@example.com" },
           headers: headers

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "GET /api/v1/admin/finance/pro_grants" do
    let!(:auth) { setup_authentication(user: admin_user, space: admin_space) }
    let(:headers) { auth[:headers] }

    it "lists granted accounts" do
      create(:pro_grant, user: recipient, granted_by: admin_user)

      get "/api/v1/admin/finance/pro_grants", headers: headers

      expect(response).to have_http_status(:ok)
      emails = response.parsed_body.dig("data", "grants").map { |grant| grant["email"] }
      expect(emails).to eq(["early@example.com"])
    end
  end

  describe "when the caller is not an admin" do
    let(:regular_user) { create(:user) }
    let(:regular_space) { create(:personal_space) }
    let!(:auth) { setup_authentication(user: regular_user, space: regular_space) }
    let(:headers) { auth[:headers] }

    it "refuses the grant" do
      post "/api/v1/admin/finance/pro_grants",
           params: { email: recipient.email },
           headers: headers

      expect(response).to have_http_status(:forbidden)
    end
  end
end
