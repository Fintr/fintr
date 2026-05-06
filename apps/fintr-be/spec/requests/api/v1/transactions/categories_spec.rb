# frozen_string_literal: true

require 'rails_helper'

RSpec.describe "API V1 Transaction Categories", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  before do
    # Override the ::Transactions namespace to prevent collision
    allow(::Transactions::Operations::Categories::CreateCategory).to receive(:new) do
      operation_double
    end
  end

  describe "POST /api/v1/transactions/categories" do
    let(:operation_double) { instance_double(Transactions::Operations::Categories::CreateCategory) }

    context "when parameters are valid" do
      let(:valid_params) do
        {
          name: "Groceries",
          category_type: "expense"
        }
      end

      it "creates a new category" do
        # Mock the operation result
        category = build(:category, name: "Groceries", category_type: "expense")
        operation_result = Dry::Monads::Result::Success.new(category)

        # Setup the mock to respond to call
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/categories", params: valid_params, headers: headers

        # Check response
        expect(response).to have_http_status(:created)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
      end
    end

    context "when parameters are invalid" do
      let(:invalid_params) do
        {
          name: "",
          category_type: "invalid_type"
        }
      end

      it "returns validation errors" do
        # Mock operation failure result
        errors = { name: ["can't be blank"], category_type: ["is invalid"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        # Setup the mock to respond to call
        allow(operation_double).to receive(:call).and_return(operation_result)

        post "/api/v1/transactions/categories", params: invalid_params, headers: headers

        # Check response
        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end
  end

  describe "PUT /api/v1/transactions/categories/:id" do
    let(:operation_double) { instance_double(Transactions::Operations::Categories::UpdateCategory) }
    let!(:category_to_update) { create(:category, space: space, name: "Original Name") }

    before do
      allow(::Transactions::Operations::Categories::UpdateCategory).to receive(:new).and_return(operation_double)
    end

    context "when parameters are valid" do
      let(:valid_params) do
        {
          id: category_to_update.id,
          name: "Updated Category Name"
        }
      end

      it "updates the category" do
        updated_category = build(:category, name: "Updated Category Name")
        operation_result = Dry::Monads::Result::Success.new(updated_category)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/categories/#{category_to_update.id}", params: valid_params, headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
      end
    end

    context "when parameters are invalid" do
      let(:invalid_params) do
        {
          id: category_to_update.id,
          name: ""
        }
      end

      it "returns validation errors" do
        errors = { name: ["can't be blank"] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        put "/api/v1/transactions/categories/#{category_to_update.id}", params: invalid_params, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end
  end

  describe "DELETE /api/v1/transactions/categories/:id" do
    let(:operation_double) { instance_double(Transactions::Operations::Categories::DeleteCategory) }
    let!(:category_to_delete) { create(:category, space: space, name: "Category to Delete") }

    before do
      allow(::Transactions::Operations::Categories::DeleteCategory).to receive(:new).and_return(operation_double)
    end

    context "when deletion is successful" do
      let(:valid_params) do
        {
          id: category_to_delete.id
        }
      end

      it "deletes the category" do
        operation_result = Dry::Monads::Result::Success.new(true)

        allow(operation_double).to receive(:call).and_return(operation_result)

        delete "/api/v1/transactions/categories/#{category_to_delete.id}", params: valid_params, headers: headers

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => true)
        expect(parsed_response).to include("message")
      end
    end

    context "when deletion fails (e.g., category not found or has transactions)" do
      let(:invalid_params) do
        {
          id: category_to_delete.id
        }
      end

      it "returns unprocessable entity with errors" do
        errors = { category: ["Cannot delete category. There are transactions associated with the category."] }
        operation_result = Dry::Monads::Result::Failure.new(errors)

        allow(operation_double).to receive(:call).and_return(operation_result)

        delete "/api/v1/transactions/categories/#{category_to_delete.id}", params: invalid_params, headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        expect(response.content_type).to include('application/json')

        parsed_response = JSON.parse(response.body)
        expect(parsed_response).to include("success" => false)
        expect(parsed_response).to include("error")
        expect(parsed_response["error"]).to include("details")
      end
    end
  end
end
