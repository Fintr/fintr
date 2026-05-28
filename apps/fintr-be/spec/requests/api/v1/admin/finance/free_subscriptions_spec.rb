# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Admin::Finance::FreeSubscriptions", type: :request do
  let(:admin_user) { create(:user) }
  let(:regular_user) { create(:user) }
  let(:admin_space) { create(:personal_space) }
  let(:target_space) { create(:personal_space) }
  let(:subscription_plan) do
    create(
      :subscription_plan,
      slug: "free-plan-#{SecureRandom.hex(4)}",
      interval: "month",
      token_limit: 1_000
    )
  end

  before do
    create(:space_user, space: admin_space, user: admin_user)
    admin_user.add_role(:admin)
  end

  describe "GET /api/v1/admin/finance/free_subscriptions/spaces" do
    let!(:auth) { setup_authentication(user: admin_user, space: admin_space) }
    let(:headers) { auth[:headers] }

    let(:owner) { create(:user, email: "spaces-list@example.com") }
    let!(:listed_space) do
      create(
        :personal_space,
        name: "Listed Space",
        code: "listed-space",
        owner:,
      )
    end

    before do
      2.times { create(:transaction, space: listed_space, user: owner) }
    end

    it "returns paginated spaces ordered by transaction count" do
      get "/api/v1/admin/finance/free_subscriptions/spaces",
          params: { page: 1, per_page: 25 },
          headers: headers

      expect(response).to have_http_status(:ok)

      body = response.parsed_body
      spaces = body.dig("data", "spaces")
      pagination = body.dig("data", "pagination")

      expect(spaces).to be_present
      expect(pagination["totalCount"]).to be >= 1

      first = spaces.first
      expect(first["transactionsCount"]).to eq(2)
      expect(first["name"]).to eq("Listed Space")
    end

    it "filters spaces by search query" do
      get "/api/v1/admin/finance/free_subscriptions/spaces",
          params: { search_query: "listed-space", page: 1, per_page: 25 },
          headers: headers

      expect(response).to have_http_status(:ok)

      ids = response.parsed_body.dig("data", "spaces").map { |row| row["id"] }
      expect(ids).to eq([listed_space.id])
    end
  end

  describe "DELETE /api/v1/admin/finance/free_subscriptions/remove" do
    let(:valid_params) { { space_id: target_space.id.to_s } }

    context "when authenticated as admin user" do
      let!(:auth) { setup_authentication(user: admin_user, space: admin_space) }
      let(:headers) { auth[:headers] }

      context "when space has active free subscription" do
        let!(:free_subscription) do
          create(
            :space_subscription,
            :free,
            :active,
            space: target_space,
            subscription_plan: subscription_plan,
            metadata: {}
          )
        end

        it "returns HTTP status ok" do
          delete "/api/v1/admin/finance/free_subscriptions/remove",
                 params: valid_params,
                 headers: headers

          expect(response).to have_http_status(:ok)
        end

        it "deactivates the free subscription" do
          delete "/api/v1/admin/finance/free_subscriptions/remove",
                 params: valid_params,
                 headers: headers

          expect(free_subscription.reload.status).to eq("inactive")
          expect(free_subscription.ended_at).to be_present
          expect(free_subscription.cancelled_at).to be_present
        end
      end

      context "when space has no active free subscription" do
        it "returns HTTP status unprocessable_content" do
          delete "/api/v1/admin/finance/free_subscriptions/remove",
                 params: valid_params,
                 headers: headers

          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      context "when space is not found" do
        it "returns HTTP status unprocessable_content" do
          delete "/api/v1/admin/finance/free_subscriptions/remove",
                 params: { space_id: "invalid-id" },
                 headers: headers

          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end

    context "when authenticated as non-admin user" do
      let(:non_admin_space) { create(:personal_space) }
      let!(:auth) { setup_authentication(user: regular_user, space: non_admin_space) }
      let(:headers) { auth[:headers] }

      it "returns HTTP status forbidden" do
        delete "/api/v1/admin/finance/free_subscriptions/remove",
               params: valid_params,
               headers: headers

        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when not authenticated" do
      it "returns HTTP status unauthorized" do
        delete "/api/v1/admin/finance/free_subscriptions/remove",
               params: valid_params

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
