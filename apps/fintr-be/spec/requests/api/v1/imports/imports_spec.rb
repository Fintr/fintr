# frozen_string_literal: true

require "rails_helper"

# rubocop:disable RSpec/SpecFilePathFormat
# Request specs remove the _controller suffix per .cursor/rules/specs/request_specs.mdc
RSpec.describe Api::V1::Imports::ImportsController, type: :request do
  # rubocop:enable RSpec/SpecFilePathFormat
  let(:user) { create(:user) }
  let(:space) { create(:organization_space) }
  let!(:user_space) { create(:space_user, user: user, space: space) }

  let(:auth_setup) { setup_authentication(user: user, space: space, auth_id: user.auth_id) }

  describe "GET /api/v1/imports/imports" do
    let!(:import1) do
      Imports::Import.create!(
        user: user,
        space: space,
        import_location: "onboarding",
        status: "completed"
      )
    end
    let!(:import2) do
      Imports::Import.create!(
        user: user,
        space: space,
        import_location: "settings",
        status: "pending"
      )
    end
    let!(:other_space_import) do
      other_space = create(:organization_space)
      Imports::Import.create!(
        user: user,
        space: other_space,
        import_location: "onboarding",
        status: "completed"
      )
    end

    it "returns user's imports for the current space" do
      get "/api/v1/imports/imports", params: { page: 1 }, headers: auth_setup[:headers]

      expect(response).to have_http_status(:ok)
      json_response = JSON.parse(response.body)
      imports_data = json_response["data"]["imports"]
      expect(imports_data.length).to eq(2)
      import_ids = imports_data.map { |i| i["id"] }
      expect(import_ids).to include(import1.id.to_s, import2.id.to_s)
      expect(import_ids).not_to include(other_space_import.id.to_s)
    end

    context "when filtering by status" do
      it "returns only imports with the specified status" do
        get "/api/v1/imports/imports", params: { page: 1, status: "completed" }, headers: auth_setup[:headers]

        expect(response).to have_http_status(:ok)
        json_response = JSON.parse(response.body)
        imports_data = json_response["data"]["imports"]
        expect(imports_data.length).to eq(1)
        expect(imports_data.first["id"]).to eq(import1.id.to_s)
      end
    end

    context "when the query fails" do
      let(:mock_query) { instance_double(Imports::Queries::ListImports) }
      let(:failure_result) { Dry::Monads::Result::Failure.new("Query failed") }

      before do
        allow(Imports::Queries::ListImports).to receive(:new).and_return(mock_query)
        allow(mock_query).to receive(:call).and_return(failure_result)

        get "/api/v1/imports/imports", params: { page: 1 }, headers: auth_setup[:headers]
      end

      it "returns an HTTP status internal_server_error" do
        expect(response).to have_http_status(:internal_server_error)
      end
    end
  end

  describe "GET /api/v1/imports/imports/:id" do
    let!(:import) do
      Imports::Import.create!(
        user: user,
        space: space,
        import_location: "onboarding",
        status: "completed"
      )
    end

    it "returns import details" do
      get "/api/v1/imports/imports/#{import.id}", headers: auth_setup[:headers]

      expect(response).to have_http_status(:ok)
      json_response = JSON.parse(response.body)
      expect(json_response["data"]["import"]["id"]).to eq(import.id.to_s)
    end

    it "returns 404 for non-existent import" do
      get "/api/v1/imports/imports/999999", headers: auth_setup[:headers]

      expect(response).to have_http_status(:not_found)
      json_response = JSON.parse(response.body)
      expect(json_response["success"]).to be(false)
      expect(json_response["error"]["details"]).to eq("Import not found")
    end

    it "returns 404 for import from different space" do
      other_space = create(:organization_space)
      other_import = Imports::Import.create!(
        user: user,
        space: other_space,
        import_location: "onboarding",
        status: "completed"
      )

      get "/api/v1/imports/imports/#{other_import.id}", headers: auth_setup[:headers]

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/imports/imports" do
    let(:file) do
      Rack::Test::UploadedFile.new(
        StringIO.new("fake excel content"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        original_filename: "test_file.xlsx"
      )
    end
    let(:valid_params) { { import_location: "onboarding", file: file } }
    let(:mock_create_operation) { instance_double(Imports::Operations::CreateImport) }

    context "when the request is successful" do
      let(:created_import) do
        Imports::Import.create!(
          user: user,
          space: space,
          import_location: "onboarding",
          status: "pending"
        )
      end
      let(:call_args) { [] }
      let(:call_kwargs) { {} }

      before do
        allow(Imports::Operations::CreateImport).to receive(:new).and_return(mock_create_operation)
        allow(mock_create_operation).to receive(:call) do |*args, **kwargs|
          call_args.concat(args)
          call_kwargs.merge!(kwargs)
          Dry::Monads::Result::Success.new(created_import)
        end

        post "/api/v1/imports/imports", params: valid_params, headers: auth_setup[:headers]
      end

      it "returns an HTTP status created" do
        expect(response).to have_http_status(:created)
      end

      it "calls the CreateImport operation with correct parameters" do
        params_hash = call_args[0].to_h
        expect(params_hash).to include(
          "user_id" => user.id.to_s,
          "space_id" => space.id.to_s,
          "space_code" => space.code,
          "import_location" => valid_params[:import_location]
        )
        # File is merged into params_hash, not passed as keyword argument
        expect(params_hash["file"]).to be_present
      end

      it "returns the created import in the response" do
        json_response = JSON.parse(response.body)
        expect(json_response["data"]["import"]["id"]).to eq(created_import.id.to_s)
      end
    end

    context "when the operation fails" do
      let(:failure_details) { { "error" => "Failed to create import" } }

      before do
        allow(Imports::Operations::CreateImport).to receive(:new).and_return(mock_create_operation)
        allow(mock_create_operation).to receive(:call)
          .and_return(Dry::Monads::Result::Failure.new(failure_details))

        post "/api/v1/imports/imports", params: valid_params, headers: auth_setup[:headers]
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
        allow(Imports::Operations::CreateImport).to receive(:new).and_return(mock_create_operation)
        allow(mock_create_operation).to receive(:call)
          .and_return(Dry::Monads::Result::Failure.new({ "error" => "Validation failed" }))

        post "/api/v1/imports/imports", params: { import_location: nil }, headers: auth_setup[:headers]
      end

      it "returns an HTTP status unprocessable_content" do
        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end

  describe "POST /api/v1/imports/imports/:id/revert" do
    let!(:import) do
      Imports::Import.create!(
        user: user,
        space: space,
        import_location: "onboarding",
        status: "completed"
      )
    end
    let(:mock_revert_operation) { instance_double(Imports::Operations::RevertImport) }

    context "when the request is successful" do
      let(:revert_result) do
        {
          message: "Import reverted successfully: 5 transactions deleted",
          reverted_count: 5,
          deleted_categories_count: 0
        }
      end

      before do
        allow(Imports::Operations::RevertImport).to receive(:new).and_return(mock_revert_operation)
        allow(mock_revert_operation).to receive(:call)
          .and_return(Dry::Monads::Result::Success.new(revert_result))

        post "/api/v1/imports/imports/#{import.id}/revert", headers: auth_setup[:headers]
      end

      it "returns an HTTP status ok" do
        expect(response).to have_http_status(:ok)
      end

      it "returns the revert message in the response" do
        json_response = JSON.parse(response.body)
        expect(json_response["message"]).to eq(revert_result[:message])
        expect(json_response["data"]).to be_present
        # The serializer returns the import data directly, not nested under "import"
        expect(json_response["data"]["id"]).to eq(import.id.to_s)
      end

      it "calls the RevertImport operation with the import" do
        expect(mock_revert_operation).to have_received(:call).with(import: import)
      end
    end

    context "when the operation fails" do
      let(:failure_details) { { "error" => "Import cannot be reverted" } }

      before do
        allow(Imports::Operations::RevertImport).to receive(:new).and_return(mock_revert_operation)
        allow(mock_revert_operation).to receive(:call)
          .and_return(Dry::Monads::Result::Failure.new(failure_details))

        post "/api/v1/imports/imports/#{import.id}/revert", headers: auth_setup[:headers]
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

    it "returns 404 for non-existent import" do
      post "/api/v1/imports/imports/999999/revert", headers: auth_setup[:headers]

      expect(response).to have_http_status(:not_found)
      json_response = JSON.parse(response.body)
      expect(json_response["success"]).to be(false)
      expect(json_response["error"]["details"]).to eq("Import not found")
    end

    it "returns 404 for import from different space" do
      other_space = create(:organization_space)
      other_import = Imports::Import.create!(
        user: user,
        space: other_space,
        import_location: "onboarding",
        status: "completed"
      )

      post "/api/v1/imports/imports/#{other_import.id}/revert", headers: auth_setup[:headers]

      expect(response).to have_http_status(:not_found)
    end
  end
end
