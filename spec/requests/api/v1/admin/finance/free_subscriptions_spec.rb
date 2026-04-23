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
