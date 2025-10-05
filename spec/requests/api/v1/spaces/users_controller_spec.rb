# frozen_string_literal: true

require "rails_helper"

RSpec.describe Api::V1::Spaces::UsersController, type: :request do
  let(:admin_user) { create(:user) }
  let(:member_user) { create(:user) }
  let(:target_user) { create(:user) }
  let(:space) { create(:organization_space) }

  let(:admin_auth) { setup_authentication(user: admin_user, space: space, auth_id: admin_user.auth_id) }
  let(:member_auth) { setup_authentication(user: member_user, space: space, auth_id: member_user.auth_id) }

  before do
    # Set up admin user
    create(:space_user, user: admin_user, space: space)
    admin_user.add_role(:admin, space)

    # Set up member user
    create(:space_user, user: member_user, space: space)
    member_user.add_role(:member, space)
  end

  describe "GET /api/v1/spaces/:space_code/users" do
    it "returns space users for admin" do
      get "/api/v1/spaces/#{space.code}/users", headers: admin_auth[:headers]

      expect(response).to have_http_status(:ok)
      users_data = JSON.parse(response.body)["data"]["users"]
      expect(users_data.length).to eq(2) # admin_user and member_user
    end

    context "when as non-admin user" do
      it "returns 403 for non-admin" do
        get "/api/v1/spaces/#{space.code}/users", headers: member_auth[:headers]

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "POST /api/v1/spaces/:space_code/users/grant_access" do
    let(:grant_params) { { email: target_user.email, role: "member" } }

    it "grants access to user" do
      expect {
        post "/api/v1/spaces/#{space.code}/users/grant_access", params: grant_params, headers: admin_auth[:headers]
      }.to change(Spaces::SpaceUser, :count).by(1)

      expect(response).to have_http_status(:ok)
      expect(target_user.reload.spaces).to include(space)
      expect(target_user.has_role?(:member, space)).to be true
    end

    it "grants admin role when specified" do
      admin_params = { email: target_user.email, role: "admin" }

      post "/api/v1/spaces/#{space.code}/users/grant_access", params: admin_params, headers: admin_auth[:headers]

      expect(response).to have_http_status(:ok)
      expect(target_user.reload.has_role?(:admin, space)).to be true
    end

    it "returns error for non-existent user" do
      invalid_params = { email: "nonexistent@example.com", role: "member" }

      post "/api/v1/spaces/#{space.code}/users/grant_access", params: invalid_params, headers: admin_auth[:headers]

      expect(response).to have_http_status(:unprocessable_entity)
    end

    context "when as non-admin user" do
      it "returns 403 for non-admin" do
        post "/api/v1/spaces/#{space.code}/users/grant_access", params: grant_params, headers: member_auth[:headers]

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "DELETE /api/v1/spaces/:space_code/users/:user_id" do
    let!(:target_space_user) { create(:space_user, user: target_user, space: space) }

    it "removes user from space" do
      expect {
        delete "/api/v1/spaces/#{space.code}/users/#{target_user.id}/remove", headers: admin_auth[:headers]
      }.to change(Spaces::SpaceUser, :count).by(-1)

      expect(response).to have_http_status(:ok)
      expect(target_user.reload.spaces).not_to include(space)
    end

    it "returns error when trying to remove admin user" do
      delete "/api/v1/spaces/#{space.code}/users/#{admin_user.id}/remove", headers: admin_auth[:headers]

      expect(response).to have_http_status(:unprocessable_entity)
    end

    context "when as non-admin user" do
      it "returns 403 for non-admin" do
        delete "/api/v1/spaces/#{space.code}/users/#{target_user.id}/remove", headers: member_auth[:headers]

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
