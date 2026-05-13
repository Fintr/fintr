# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Admin::Users", type: :request do
  let(:space) { create(:space) }
  let(:admin_user) { create(:admin_user) }
  let!(:auth) { setup_authentication(user: admin_user, space: space) }
  let(:headers) { auth[:headers] }

  describe "GET /api/v1/admin/users" do
    before do
      create_list(:user, 12)
    end

    it "returns paginated users" do
      get "/api/v1/admin/users",
          params: { page: 1, per_page: 5 },
          headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["data"]["users"].length).to eq(5)
      pagination = json["data"]["pagination"]
      expect(pagination["currentPage"]).to eq(1)
      expect(pagination["totalCount"]).to be >= 13
      expect(pagination["totalPages"]).to be >= 3
    end

    it "returns the requested page" do
      get "/api/v1/admin/users",
          params: { page: 2, per_page: 5 },
          headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["data"]["pagination"]["currentPage"]).to eq(2)
      expect(json["data"]["users"].length).to eq(5)
    end

    it "filters by search_query on email" do
      target = create(:user, email: "unique_admin_filter@example.com")

      get "/api/v1/admin/users",
          params: { search_query: "unique_admin_filter" },
          headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      emails = json["data"]["users"].map { |u| u["email"] }
      expect(emails).to include(target.email)
      expect(emails.length).to eq(1)
    end

    it "filters by search_query on full name" do
      target = create(:user, full_name: "Zeta Unique Admin Name Xyzzy")

      get "/api/v1/admin/users",
          params: { search_query: "Zeta Unique Admin" },
          headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      names = json["data"]["users"].map { |u| u["fullName"] }
      expect(names).to include(target.full_name)
      expect(json["data"]["users"].length).to eq(1)
    end

    it "filters via middleware-normalized camelCase query key (searchQuery -> search_query)" do
      target = create(:user, email: "camel_case_admin@example.com")

      get "/api/v1/admin/users",
          params: { searchQuery: "camel_case_admin", page: 1 },
          headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["data"]["users"].map { |u| u["email"] }).to include(target.email)
    end
  end
end
