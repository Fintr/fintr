# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Admin::ProductPulseFeedbacks", type: :request do
  let(:space) { create(:space) }
  let(:admin_user) { create(:admin_user) }
  let!(:auth) { setup_authentication(user: admin_user, space: space) }
  let(:headers) { auth[:headers].merge({ "Accept" => "application/json" }) }

  let!(:feedback) do
    create(
      :product_pulse_feedback,
      user: admin_user,
      space: space,
      liked_areas: %w[insights],
      improve_areas: %w[speed],
      notes: "Test note"
    )
  end

  describe "GET /api/v1/admin/product_pulse_feedbacks" do
    context "when user is admin" do
      it "returns ok" do
        get "/api/v1/admin/product_pulse_feedbacks", headers: headers

        expect(response).to have_http_status(:ok)
      end

      it "includes product pulse feedbacks" do
        get "/api/v1/admin/product_pulse_feedbacks", headers: headers

        body = JSON.parse(response.body)
        expect(body["success"]).to be true
        expect(body["data"]["productPulseFeedbacks"].length).to be >= 1
      end

      it "filters by space name (case insensitive partial match)" do
        matching_space = create(:space, name: "Acme Corp Weekly Pulse XYZ")
        other_space = create(:space, name: "Different Org")
        user_for_filter = create(:user)
        create(
          :product_pulse_feedback,
          user: user_for_filter,
          space: matching_space,
          liked_areas: %w[budgets],
          improve_areas: [],
          notes: nil
        )
        create(
          :product_pulse_feedback,
          user: user_for_filter,
          space: other_space,
          liked_areas: %w[loans],
          improve_areas: [],
          notes: nil
        )

        get "/api/v1/admin/product_pulse_feedbacks",
             params: { space_name: "acme corp weekly" },
             headers: headers

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        rows = body["data"]["productPulseFeedbacks"]
        space_ids = rows.map { |r| r.dig("space", "id") }.compact.uniq
        expect(space_ids).to eq([matching_space.id.to_s])
        expect(rows.length).to eq(1)
      end
    end
  end
end
