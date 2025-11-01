# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Admin::Ai::AiInteractions", type: :request do
  let(:space) { create(:space) }
  let(:admin_user) { create(:admin_user) }
  let(:regular_user) { create(:user) }
  let!(:auth) { setup_authentication(user: admin_user, space: space) }
  let(:headers) { auth[:headers] }

  let!(:interaction1) do
    create(:ai_interaction,
           user: admin_user,
           space: space,
           status: "success",
           request: "What are my spending patterns?",
           response: "Based on your data...",
           tokens_used: 150,
           time_seconds: 2.5)
  end

  let!(:interaction2) do
    create(:ai_interaction,
           user: regular_user,
           space: space,
           status: "failure",
           request: "Show me my budget",
           error: "Processing error",
           tokens_used: 0,
           time_seconds: 0.0)
  end

  let!(:interaction3) do
    create(:ai_interaction,
           user: admin_user,
           space: space,
           status: "pending",
           request: "Analyze my income",
           tokens_used: 0,
           time_seconds: 0.0)
  end

  describe "GET /api/v1/admin/ai/ai_interactions" do
    context "when user is admin" do
      it "returns a successful response" do
        get "/api/v1/admin/ai/ai_interactions", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include("application/json")
      end

      it "returns all interactions with user and space data" do
        get "/api/v1/admin/ai/ai_interactions", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["data"]).to be_an(Array)
        expect(json_response["data"].length).to eq(3)

        interaction_data = json_response["data"].find { |item| item["id"] == interaction1.id }
        expect(interaction_data).to include(
          "id" => interaction1.id,
          "session_id" => interaction1.session_id,
          "request" => "What are my spending patterns?",
          "response" => "Based on your data...",
          "status" => "success",
          "tokens_used" => 150,
          "time_seconds" => "2.5"
        )

        expect(interaction_data["user"]).to include(
          "id" => admin_user.id,
          "email" => admin_user.email
        )

        expect(interaction_data["space"]).to include(
          "id" => space.id,
          "name" => space.name,
          "code" => space.code
        )
      end

      it "includes meta information with total count and filters" do
        get "/api/v1/admin/ai/ai_interactions", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["meta"]).to include(
          "total_count" => 3,
          "filters" => {
            "status" => nil,
            "space_id" => nil,
            "user_id" => nil,
            "start_date" => nil,
            "end_date" => nil
          }
        )
      end

      it "filters by status" do
        get "/api/v1/admin/ai/ai_interactions",
            params: { status: "success" },
            headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["data"].length).to eq(1)
        expect(json_response["data"].first["status"]).to eq("success")
        expect(json_response["meta"]["filters"]["status"]).to eq("success")
      end

      it "filters by space_id" do
        other_space = create(:space)
        create(:ai_interaction, user: admin_user, space: other_space)

        get "/api/v1/admin/ai/ai_interactions",
            params: { space_id: space.id },
            headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["data"].length).to eq(3)
        expect(json_response["meta"]["filters"]["space_id"]).to eq(space.id.to_s)
      end

      it "filters by user_id" do
        get "/api/v1/admin/ai/ai_interactions",
            params: { user_id: admin_user.id },
            headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["data"].length).to eq(2)
        expect(json_response["meta"]["filters"]["user_id"]).to eq(admin_user.id.to_s)
      end

      it "filters by date range" do
        start_date = 1.day.ago.strftime("%Y-%m-%d")
        end_date = Date.current.strftime("%Y-%m-%d")

        get "/api/v1/admin/ai/ai_interactions",
            params: { start_date: start_date, end_date: end_date },
            headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["data"].length).to eq(3)
        expect(json_response["meta"]["filters"]["start_date"]).to eq(start_date)
        expect(json_response["meta"]["filters"]["end_date"]).to eq(end_date)
      end

      it "raises error for invalid date format" do
        expect {
          get "/api/v1/admin/ai/ai_interactions",
              params: { start_date: "invalid-date", end_date: "2023-12-31" },
              headers: headers
        }.to raise_error(Date::Error, "invalid date")
      end

      it "handles invalid date range when start_date is after end_date" do
        start_date = Date.current.strftime("%Y-%m-%d")
        end_date = 1.day.ago.strftime("%Y-%m-%d")

        get "/api/v1/admin/ai/ai_interactions",
            params: { start_date: start_date, end_date: end_date },
            headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["data"].length).to eq(0)
      end

      it "limits results to 100 interactions" do
        # Create more than 100 interactions
        102.times do |i|
          create(:ai_interaction,
                 user: admin_user,
                 space: space,
                 request: "Request #{i}")
        end

        get "/api/v1/admin/ai/ai_interactions", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["data"].length).to eq(100)
      end

      it "orders interactions by created_at desc" do
        get "/api/v1/admin/ai/ai_interactions", headers: headers

        json_response = JSON.parse(response.body)
        created_dates = json_response["data"].map { |item| item["created_at"] }
        expect(created_dates).to eq(created_dates.sort.reverse)
      end
    end

    context "when user is not admin" do
      let!(:regular_auth) { setup_authentication(user: regular_user, space: space) }
      let(:regular_headers) { regular_auth[:headers] }

      it "returns forbidden status" do
        get "/api/v1/admin/ai/ai_interactions", headers: regular_headers

        expect(response).to have_http_status(:forbidden)
        expect(JSON.parse(response.body)["error"]).to eq("Unauthorized")
      end
    end
  end

  describe "GET /api/v1/admin/ai/ai_interactions/:id" do
    context "when user is admin" do
      it "returns a successful response" do
        get "/api/v1/admin/ai/ai_interactions/#{interaction1.id}", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include("application/json")
      end

      it "returns the specific interaction with user and space data" do
        get "/api/v1/admin/ai/ai_interactions/#{interaction1.id}", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response["data"]).to include(
          "id" => interaction1.id,
          "session_id" => interaction1.session_id,
          "request" => "What are my spending patterns?",
          "response" => "Based on your data...",
          "status" => "success",
          "tokens_used" => 150,
          "time_seconds" => "2.5"
        )

        expect(json_response["data"]["user"]).to include(
          "id" => admin_user.id,
          "email" => admin_user.email
        )

        expect(json_response["data"]["space"]).to include(
          "id" => space.id,
          "name" => space.name,
          "code" => space.code
        )
      end

      it "includes all interaction fields" do
        get "/api/v1/admin/ai/ai_interactions/#{interaction1.id}", headers: headers

        json_response = JSON.parse(response.body)
        interaction_data = json_response["data"]

        expect(interaction_data).to include(
          "enhanced_prompt",
          "error",
          "metadata",
          "created_at",
          "updated_at"
        )
      end

      it "returns 404 for non-existent interaction" do
        get "/api/v1/admin/ai/ai_interactions/999999", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context "when user is not admin" do
      let!(:regular_auth) { setup_authentication(user: regular_user, space: space) }
      let(:regular_headers) { regular_auth[:headers] }

      it "returns forbidden status" do
        get "/api/v1/admin/ai/ai_interactions/#{interaction1.id}", headers: regular_headers

        expect(response).to have_http_status(:forbidden)
        expect(JSON.parse(response.body)["error"]).to eq("Unauthorized")
      end
    end
  end

  describe "GET /api/v1/admin/ai/ai_interactions/stats" do
    context "when user is admin" do
      it "returns a successful response" do
        get "/api/v1/admin/ai/ai_interactions/stats", headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include("application/json")
      end

      it "returns summary statistics" do
        get "/api/v1/admin/ai/ai_interactions/stats", headers: headers

        json_response = JSON.parse(response.body)
        summary = json_response["data"]["summary"]

        expect(summary).to include(
          "total_interactions" => 3,
          "successful_interactions" => 1,
          "failed_interactions" => 1,
          "success_rate" => 33.33,
          "total_tokens" => 150
        )
        expect(summary["avg_response_time"]).to be_present
      end

      it "returns status breakdown" do
        get "/api/v1/admin/ai/ai_interactions/stats", headers: headers

        json_response = JSON.parse(response.body)
        status_breakdown = json_response["data"]["status_breakdown"]

        expect(status_breakdown).to include(
          "success" => 1,
          "failure" => 1,
          "pending" => 1
        )
      end

      it "returns top users by interaction count" do
        get "/api/v1/admin/ai/ai_interactions/stats", headers: headers

        json_response = JSON.parse(response.body)
        top_users = json_response["data"]["top_users"]

        expect(top_users).to be_an(Array)
        expect(top_users.length).to be <= 10
        expect(top_users.first).to include("user", "count")
      end

      it "returns top spaces by interaction count" do
        get "/api/v1/admin/ai/ai_interactions/stats", headers: headers

        json_response = JSON.parse(response.body)
        top_spaces = json_response["data"]["top_spaces"]

        expect(top_spaces).to be_an(Array)
        expect(top_spaces.length).to be <= 10
        expect(top_spaces.first).to include("space", "count")
      end

      it "returns daily interactions for last 30 days" do
        get "/api/v1/admin/ai/ai_interactions/stats", headers: headers

        json_response = JSON.parse(response.body)
        daily_interactions = json_response["data"]["daily_interactions"]

        expect(daily_interactions).to be_a(Hash)
        expect(daily_interactions.keys).to all(be_a(String))
        expect(daily_interactions.values).to all(be_a(Integer))
      end

      it "calculates success rate correctly when no interactions" do
        # Clear all interactions
        Ai::Interaction.destroy_all

        get "/api/v1/admin/ai/ai_interactions/stats", headers: headers

        json_response = JSON.parse(response.body)
        summary = json_response["data"]["summary"]

        expect(summary["total_interactions"]).to eq(0)
        expect(summary["success_rate"]).to eq(0)
      end

      it "handles empty data gracefully in stats" do
        # Clear all interactions
        Ai::Interaction.destroy_all

        get "/api/v1/admin/ai/ai_interactions/stats", headers: headers

        json_response = JSON.parse(response.body)
        data = json_response["data"]

        expect(data["summary"]["total_interactions"]).to eq(0)
        expect(data["summary"]["successful_interactions"]).to eq(0)
        expect(data["summary"]["failed_interactions"]).to eq(0)
        expect(data["summary"]["total_tokens"]).to eq(0)
        expect(data["summary"]["avg_response_time"]).to be_nil
        expect(data["status_breakdown"]).to eq({})
        expect(data["top_users"]).to eq([])
        expect(data["top_spaces"]).to eq([])
        expect(data["daily_interactions"]).to eq({})
      end
    end

    context "when user is not admin" do
      let!(:regular_auth) { setup_authentication(user: regular_user, space: space) }
      let(:regular_headers) { regular_auth[:headers] }

      it "returns forbidden status" do
        get "/api/v1/admin/ai/ai_interactions/stats", headers: regular_headers

        expect(response).to have_http_status(:forbidden)
        expect(JSON.parse(response.body)["error"]).to eq("Unauthorized")
      end
    end
  end
end
