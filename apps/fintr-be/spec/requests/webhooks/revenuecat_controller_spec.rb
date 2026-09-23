# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Webhooks::Revenuecat", type: :request do
  let(:user) { create(:user) }

  before do
    ENV["REVENUECAT_WEBHOOK_AUTHORIZATION"] = "rc_webhook_secret"
  end

  after do
    ENV.delete("REVENUECAT_WEBHOOK_AUTHORIZATION")
  end

  it "rejects a missing authorization header" do
    post "/webhooks/revenuecat", params: { event: { app_user_id: user.id } }, as: :json

    expect(response).to have_http_status(:unauthorized)
  end

  it "refreshes the customer after an authorized event" do
    sync = instance_double(Finance::Operations::Revenuecat::SyncCustomer)
    allow(Finance::Operations::Revenuecat::SyncCustomer).to receive(:new).and_return(sync)
    allow(sync).to receive(:call).with(user_id: user.id).and_return(Dry::Monads::Success(true))

    post "/webhooks/revenuecat",
         params: { event: { app_user_id: user.id, type: "INITIAL_PURCHASE" } },
         headers: { "Authorization" => "Bearer rc_webhook_secret" },
         as: :json

    expect(response).to have_http_status(:ok)
    expect(sync).to have_received(:call).with(user_id: user.id)
  end
end
