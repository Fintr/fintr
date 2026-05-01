# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Admin::UserActivity", type: :request do
  let(:space) { create(:space) }
  let(:admin_user) { create(:admin_user) }
  let!(:auth) { setup_authentication(user: admin_user, space: space) }
  let(:headers) { auth[:headers] }

  describe "GET /api/v1/admin/user_activity/activity_drilldown" do
    it "returns rows with id, email, and fullName for active users on the given date" do
      target = create(:user, email: "drill_target@example.com", full_name: "Drill Target Person")
      UserActivity.create!(
        user: target,
        activity_date: Date.current,
        api_request_count: 2,
        total_requests: 2,
        login_count: 0,
        dashboard_viewed_count: 1,
        transaction_created_count: 0
      )

      get "/api/v1/admin/user_activity/activity_drilldown",
          params: { date: Date.current.iso8601 },
          headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["success"]).to be(true)

      row = json["data"]["rows"].find { |r| r["email"] == "drill_target@example.com" }
      expect(row).to be_present
      expect(row["id"]).to eq(target.id)
      expect(row["fullName"]).to eq("Drill Target Person")
      expect(row["apiRequestCount"]).to eq(2)
      expect(row["dashboardViewedCount"]).to eq(1)
    end

    it "returns averageRow with mean usage across all users for that day" do
      u1 = create(:user, email: "avg_one@example.com", full_name: "Avg One")
      u2 = create(:user, email: "avg_two@example.com", full_name: "Avg Two")
      UserActivity.create!(
        user: u1,
        activity_date: Date.current,
        api_request_count: 2,
        total_requests: 2,
        login_count: 0,
        dashboard_viewed_count: 0,
        transaction_created_count: 0
      )
      UserActivity.create!(
        user: u2,
        activity_date: Date.current,
        api_request_count: 4,
        total_requests: 4,
        login_count: 0,
        dashboard_viewed_count: 2,
        transaction_created_count: 0
      )

      get "/api/v1/admin/user_activity/activity_drilldown",
          params: { date: Date.current.iso8601 },
          headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      avg = json["data"]["averageRow"]
      expect(avg["id"]).to eq("average")
      expect(avg["fullName"]).to eq("Average (all users)")
      expect(avg["apiRequestCount"]).to eq(3)
      expect(avg["dashboardViewedCount"]).to eq(1)
    end

    it "includes transaction and AI usage counts for the same calendar day" do
      target = create(:user, email: "metrics_user@example.com", full_name: "Metrics User")
      UserActivity.create!(
        user: target,
        activity_date: Date.current,
        api_request_count: 1,
        total_requests: 1,
        login_count: 0,
        dashboard_viewed_count: 0,
        transaction_created_count: 0
      )

      create(
        :income_transaction,
        user: target,
        space: space,
        created_at: Time.zone.now
      )

      create(
        :ai_usage,
        :success,
        user: target,
        space: space,
        ai_type: "pure_ai_ocr",
        created_at: Time.zone.now
      )

      create(
        :ai_usage,
        :ai_chat,
        :success,
        user: target,
        space: space,
        created_at: Time.zone.now
      )

      get "/api/v1/admin/user_activity/activity_drilldown",
          params: { date: Date.current.iso8601 },
          headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      row = json["data"]["rows"].find { |r| r["email"] == "metrics_user@example.com" }
      expect(row["transactionsCreated"]).to eq(1)
      expect(row["receiptScans"]).to eq(1)
      expect(row["aiChatUsages"]).to eq(1)
    end

    it "returns 422 when date params are missing" do
      get "/api/v1/admin/user_activity/activity_drilldown",
          params: {},
          headers: headers

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "GET /api/v1/admin/user_activity/analytics" do
    it "includes accurate transaction totals from the database" do
      u = create(:user)
      create(
        :income_transaction,
        user: u,
        space: space,
        created_at: Time.zone.now
      )

      get "/api/v1/admin/user_activity/analytics",
          params: {
            start_date: Date.current.iso8601,
            end_date: Date.current.iso8601
          },
          headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["data"]["summary"]["totalTransactionsCreated"]).to eq(1)
      expect(json["data"]["activityBreakdown"]["transactionsCreated"]).to eq(1)
      expect(json["data"]).to have_key("monthlyActiveUserOcr")
      expect(json["data"]).to have_key("ocrActiveUserSummary")
      expect(json["data"]["ocrActiveUserSummary"]["minActiveDaysRequired"]).to eq(15)
      meta = json["data"]["monthlyActiveUserOcrMeta"]
      expect(meta["page"]).to eq(1)
      expect(meta["perPage"]).to eq(12)
      expect(meta["totalCount"]).to be >= 1
      expect(meta["totalPages"]).to be >= 1
    end

    it "paginates monthly OCR rows via monthly_ocr_page" do
      get "/api/v1/admin/user_activity/analytics",
          params: {
            start_date: Date.new(2025, 1, 1).iso8601,
            end_date: Date.new(2026, 12, 31).iso8601,
            monthly_ocr_page: 2,
            monthly_ocr_per_page: 5
          },
          headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      rows = json["data"]["monthlyActiveUserOcr"]
      meta = json["data"]["monthlyActiveUserOcrMeta"]
      expect(rows.size).to eq(5)
      expect(rows.first["month"]).to eq("2025-06-01")
      expect(meta["page"]).to eq(2)
      expect(meta["perPage"]).to eq(5)
      expect(meta["totalCount"]).to eq(24)
      expect(meta["totalPages"]).to eq(5)
    end
  end
end
