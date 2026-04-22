# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Admin::Finance::Subscriptions", type: :request do
  let(:admin_user) { create(:user) }
  let(:regular_user) { create(:user) }
  let(:target_user) { create(:user) }
  let(:admin_space) { create(:personal_space) }
  let(:target_space) { create(:personal_space) }
  let(:subscription_plan) { create(:subscription_plan, slug: "pro-#{SecureRandom.hex(4)}", token_limit: 300, price_cents: 29_900, interval: "month") }

  before do
    create(:space_user, space: admin_space, user: admin_user)
    create(:space_user, space: target_space, user: target_user)
    admin_user.add_role(:admin)
  end

  describe "POST /api/v1/admin/finance/subscriptions/create_sponsor" do
    let(:valid_params) do
      {
        space_id: target_space.id.to_s,
        subscription_plan_id: subscription_plan.id.to_s,
        sponsor_code: "TECH_CORP_2024",
        sponsor_notes: "Jane from TechCorp"
      }
    end

    context "when authenticated as admin" do
      let!(:auth) { setup_authentication(user: admin_user, space: admin_space) }
      let(:headers) { auth[:headers] }

      context "with valid parameters" do
        it "returns HTTP status created" do
          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: valid_params,
               headers: headers

          expect(response).to have_http_status(:created)
        end

        it "creates a sponsor subscription" do
          expect {
            post "/api/v1/admin/finance/subscriptions/create_sponsor",
                 params: valid_params,
                 headers: headers
          }.to change(Finance::SpaceSubscription, :count).by(1)
        end

        it "returns subscription data in response" do
          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: valid_params,
               headers: headers

          json_response = JSON.parse(response.body)
          expect(json_response["success"]).to be(true)
          expect(json_response["data"]).to have_key("subscription")
          expect(json_response["message"]).to eq("Sponsor subscription created successfully")
        end

        it "returns subscription with sponsor type" do
          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: valid_params,
               headers: headers

          json_response = JSON.parse(response.body)
          subscription = json_response["data"]["subscription"]
          expect(subscription["subscriptionType"]).to eq("sponsor")
          expect(subscription["isSponsorSubscription"]).to be(true)
        end

        it "returns sponsor metadata in response" do
          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: valid_params,
               headers: headers

          json_response = JSON.parse(response.body)
          sponsor_metadata = json_response["data"]["subscription"]["sponsorMetadata"]
          expect(sponsor_metadata).to be_present
          expect(sponsor_metadata["sponsorCode"]).to eq("TECH_CORP_2024")
          expect(sponsor_metadata["sponsorNotes"]).to eq("Jane from TechCorp")
          expect(sponsor_metadata["createdBy"]).to eq(admin_user.id.to_s)
        end
      end

      context "with missing space_id" do
        it "returns HTTP status unprocessable_content" do
          params = valid_params.except(:space_id)

          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: params,
               headers: headers

          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      context "with missing subscription_plan_id" do
        it "returns HTTP status unprocessable_content" do
          params = valid_params.except(:subscription_plan_id)

          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: params,
               headers: headers

          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      context "with invalid space_id" do
        it "returns HTTP status unprocessable_content" do
          params = valid_params.merge(space_id: "invalid-uuid")

          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: params,
               headers: headers

          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      context "when space already has active subscription" do
        before do
          create(:space_subscription, space: target_space, status: "active")
        end

        it "returns HTTP status unprocessable_content" do
          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: valid_params,
               headers: headers

          expect(response).to have_http_status(:unprocessable_content)
        end

        it "returns error message" do
          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: valid_params,
               headers: headers

          json_response = JSON.parse(response.body)
          expect(json_response["success"]).to be(false)
          expect(json_response["error"]["details"]["subscription"]).to include("already has an active subscription")
        end
      end

      context "with optional sponsor_code" do
        it "creates subscription without sponsor_code when not provided" do
          params = valid_params.except(:sponsor_code)

          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: params,
               headers: headers

          expect(response).to have_http_status(:created)

          json_response = JSON.parse(response.body)
          sponsor_metadata = json_response["data"]["subscription"]["sponsorMetadata"]
          expect(sponsor_metadata["sponsorCode"]).to be_nil
        end
      end

      context "with optional sponsor_notes" do
        it "creates subscription without sponsor_notes when not provided" do
          params = valid_params.except(:sponsor_notes)

          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: params,
               headers: headers

          expect(response).to have_http_status(:created)

          json_response = JSON.parse(response.body)
          sponsor_metadata = json_response["data"]["subscription"]["sponsorMetadata"]
          expect(sponsor_metadata["sponsorNotes"]).to be_nil
        end
      end

      context "with optional total_cycles" do
        it "creates subscription with total_cycles when provided" do
          params = valid_params.merge(total_cycles: 6)

          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: params,
               headers: headers

          expect(response).to have_http_status(:created)

          json_response = JSON.parse(response.body)
          subscription = json_response["data"]["subscription"]
          expect(subscription["totalCycles"]).to eq(6)
        end
      end
    end

    context "when authenticated as non-admin user" do
      let(:non_admin_space) { create(:personal_space) }
      let!(:auth) { setup_authentication(user: regular_user, space: non_admin_space) }
      let(:headers) { auth[:headers] }

      before do
        # Ensure regular_user does NOT have admin role
        regular_user.remove_role(:admin) if regular_user.has_role?(:admin)
      end

      it "returns HTTP status forbidden" do
        post "/api/v1/admin/finance/subscriptions/create_sponsor",
             params: valid_params,
             headers: headers

        expect(response).to have_http_status(:forbidden)
      end

      it "returns error message" do
        post "/api/v1/admin/finance/subscriptions/create_sponsor",
             params: valid_params,
             headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(false)
        expect(json_response["error"]["message"]).to eq("Permission denied")
      end

      it "does not create a subscription" do
        expect {
          post "/api/v1/admin/finance/subscriptions/create_sponsor",
               params: valid_params,
               headers: headers
        }.not_to change(Finance::SpaceSubscription, :count)
      end
    end

    context "when not authenticated" do
      it "returns HTTP status unauthorized" do
        post "/api/v1/admin/finance/subscriptions/create_sponsor",
             params: valid_params

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
