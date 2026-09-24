# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Finance::ProAccess", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  it "returns the trial Pro payload" do
    get "/api/v1/finance/pro_access", headers: headers

    expect(response).to have_http_status(:ok)
    data = JSON.parse(response.body).fetch("data")
    expect(data["pro"]).to be(true)
    expect(data["source"]).to eq("trial")
    expect(data["features"]).to be_an(Array)
  end
end
