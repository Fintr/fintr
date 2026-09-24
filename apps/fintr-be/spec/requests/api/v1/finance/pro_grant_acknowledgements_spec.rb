# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Finance::ProGrantAcknowledgements", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:headers) { auth[:headers] }

  before do
    create(:space_user, space:, user:)
  end

  let!(:auth) { setup_authentication(user:, space:) }

  describe "POST /api/v1/finance/pro_grant_acknowledgement" do
    it "marks the signed-in user's thank-you as seen" do
      create(:pro_grant, user:)

      post "/api/v1/finance/pro_grant_acknowledgement", headers: headers

      expect(response).to have_http_status(:ok)
      expect(user.reload_pro_grant.acknowledged_at).to be_present
    end
  end
end
