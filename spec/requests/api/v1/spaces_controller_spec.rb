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
    let!(:user_space) { create(:space_user, user: user, space: space) }
    let(:valid_params) { { name: "Test Space", currency: "USD" } }
    let(:mock_create_operation) { instance_double(Spaces::Operations::CreateOrganizationSpace) }

    context "when the request is successful" do
      let(:created_space) { create(:organization_space, name: valid_params[:name], currency: valid_params[:currency]) }
      let(:call_args) { [] }
      let(:call_kwargs) { {} }

      before do
        allow(Spaces::Operations::CreateOrganizationSpace).to receive(:new).and_return(mock_create_operation)
        allow(mock_create_operation).to receive(:call) do |*args, **kwargs|
          # Store arguments for verification
          call_args.concat(args)
          call_kwargs.merge!(kwargs)
          Dry::Monads::Result::Success.new(created_space)
        end

        post "/api/v1/spaces", params: valid_params, headers: auth_setup[:headers]
      end

      it "returns an HTTP status created" do
        expect(response).to have_http_status(:created)
      end

      it "calls the CreateOrganizationSpace operation with reference_space_id" do
        params_hash = call_args[0].to_h
        expect(params_hash).to include(
          "user_id" => user.id.to_s,
          "space_id" => space.id.to_s,
          "space_code" => space.code,
          "name" => valid_params[:name],
          "currency" => valid_params[:currency]
        )

        # reference_space_id is passed as a symbol key in the hash
        expect(params_hash[:reference_space_id] || params_hash["reference_space_id"]).to eq(space.id.to_s)
      end
    end

    context "when the operation fails" do
      let(:failure_details) { { "error" => "Failed to create space" } }

      before do
        allow(Spaces::Operations::CreateOrganizationSpace).to receive(:new).and_return(mock_create_operation)
        allow(mock_create_operation).to receive(:call)
          .and_return(Dry::Monads::Result::Failure.new(failure_details))

        post "/api/v1/spaces", params: valid_params, headers: auth_setup[:headers]
      end

      it "returns an HTTP status unprocessable_content" do
        expect(response).to have_http_status(:unprocessable_content)
      end

      it "returns the failure details in the response body" do
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be(false)
        expect(json_response["error"]["details"]).to eq(failure_details.deep_stringify_keys)
      end
    end

    context "when params are invalid" do
      before do
        allow(Spaces::Operations::CreateOrganizationSpace).to receive(:new).and_return(mock_create_operation)
        allow(mock_create_operation).to receive(:call)
          .and_return(Dry::Monads::Result::Failure.new({ "error" => "Validation failed" }))

        post "/api/v1/spaces", params: { name: nil }, headers: auth_setup[:headers]
      end

      it "returns an HTTP status unprocessable_content" do
        expect(response).to have_http_status(:unprocessable_content)
      end
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

      expect(response).to have_http_status(:unprocessable_content)
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
