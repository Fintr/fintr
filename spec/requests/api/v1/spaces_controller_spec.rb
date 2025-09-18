# frozen_string_literal: true

require "rails_helper"

RSpec.describe Api::V1::SpacesController, type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:organization_space) }
  
  let(:auth_setup) { setup_authentication(user: user, space: space, auth_id: user.auth_id) }

  describe "GET /api/v1/spaces" do
    let!(:user_space) { create(:space_user, user: user, space: space) }

    it "returns user's spaces" do
      get "/api/v1/spaces", headers: auth_setup[:headers]
      
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["data"]["spaces"]).to be_present
    end
  end

  describe "GET /api/v1/spaces/:code" do
    let!(:user_space) { create(:space_user, user: user, space: space) }

    it "returns space details" do
      get "/api/v1/spaces/#{space.code}", headers: auth_setup[:headers]
      
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["data"]["space"]).to be_present
    end

    it "returns 404 for non-existent space" do
      get "/api/v1/spaces/nonexistent", headers: auth_setup[:headers]
      
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/spaces" do
    let(:valid_params) { { name: "Test Space", currency: "USD" } }

    it "creates new organization space" do
      post "/api/v1/spaces", params: valid_params, headers: auth_setup[:headers]
      
      expect(response).to have_http_status(:created)
      
      # Verify the space was created with correct attributes
      created_space = Spaces::OrganizationSpace.find_by(name: valid_params[:name])
      expect(created_space).to be_present
      expect(created_space.currency).to eq(valid_params[:currency])
      expect(created_space.code).to eq("test-space")
    end

    it "returns error for invalid params" do
      post "/api/v1/spaces", params: { name: nil }, headers: auth_setup[:headers]
      
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "POST /api/v1/spaces/:code/join" do
    let!(:space_user_invitation) { create(:space_user, space: space, user: nil, invitation_status: 'pending', access_code: 'VALID123', invited_by: user) }
    let(:join_params) { { access_code: 'VALID123' } }

    it "joins user to space with valid access code" do
      expect {
        post "/api/v1/spaces/#{space.code}/join", params: join_params, headers: auth_setup[:headers]
      }.to change { space_user_invitation.reload.invitation_status }.from('pending').to('used')
      
      expect(response).to have_http_status(:ok)
      expect(user.reload.spaces).to include(space)
    end

    it "returns error for invalid access code" do
      post "/api/v1/spaces/#{space.code}/join", params: { access_code: "invalid" }, headers: auth_setup[:headers]
      
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "DELETE /api/v1/spaces/:code/leave" do
    let!(:user_space) { create(:space_user, user: user, space: space) }

    it "removes user from space" do
      expect {
        delete "/api/v1/spaces/#{space.code}/leave", headers: auth_setup[:headers]
      }.to change(Spaces::SpaceUser, :count).by(-1)
      
      expect(response).to have_http_status(:ok)
    end
  end
end
