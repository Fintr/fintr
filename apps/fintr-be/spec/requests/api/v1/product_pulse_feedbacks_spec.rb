# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::ProductPulseFeedbacks", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let!(:auth) { setup_authentication(user: user, space: space) }
  let(:headers) { auth[:headers].merge({ "Accept" => "application/json", "Content-Type" => "application/json" }) }

  describe "POST /api/v1/product_pulse_feedbacks" do
    context "when payload is valid" do
      it "persists multiple liked and improve areas" do
        expect do
          post "/api/v1/product_pulse_feedbacks",
               params: {
                 liked_areas: %w[loans budgets transactions],
                 improve_areas: %w[speed visual_design],
                 notes: "multi"
               }.to_json,
               headers: headers
        end.to change(ProductPulseFeedback, :count).by(1)

        row = ProductPulseFeedback.order(:created_at).last
        expect(row.liked_areas).to eq(%w[loans budgets transactions])
        expect(row.improve_areas).to eq(%w[speed visual_design])
      end

      it "returns created" do
        post "/api/v1/product_pulse_feedbacks",
             params: {
               liked_areas: ["transactions"],
               improve_areas: [],
               notes: "Great app"
             }.to_json,
             headers: headers

        expect(response).to have_http_status(:created)
      end

      it "persists a record" do
        expect do
          post "/api/v1/product_pulse_feedbacks",
               params: {
                 liked_areas: ["budgets"],
                 improve_areas: ["speed"],
                 notes: ""
               }.to_json,
               headers: headers
        end.to change(ProductPulseFeedback, :count).by(1)
      end
    end

    context "when payload is empty" do
      it "returns unprocessable content" do
        post "/api/v1/product_pulse_feedbacks",
             params: {
               liked_areas: [],
               improve_areas: [],
               notes: ""
             }.to_json,
             headers: headers

        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context "when duplicate submission for same week" do
      before do
        create(
          :product_pulse_feedback,
          user: user,
          space: space,
          period_key: Time.zone.today.strftime("%G-W%V"),
          liked_areas: ["transactions"],
          improve_areas: [],
          notes: nil
        )
      end

      it "returns unprocessable content" do
        post "/api/v1/product_pulse_feedbacks",
             params: {
               liked_areas: ["loans"],
               improve_areas: [],
               notes: nil
             }.to_json,
             headers: headers

        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end
end
