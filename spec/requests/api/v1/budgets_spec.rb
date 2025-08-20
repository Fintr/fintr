# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Budgets', type: :request do
  describe 'GET /api/v1/budgets' do
    let!(:user) { create(:user) } # Assuming a user factory
    let!(:space) { create(:space) }
    let(:report_data) do
      {
        totalBudgeted: 1000.0,
        totalSpent: 500.0,
        budgets: [
          { categoryName: 'Food', budgeted: 500.0, spent: 300.0, balance: 200.0 },
          { categoryName: 'Transport', budgeted: 300.0, spent: 100.0, balance: 200.0 },
          { categoryName: 'Utilities', budgeted: 200.0, spent: 100.0, balance: 100.0 }
        ]
      }
    end
    let(:date_param) { Date.new(2024, 7, 15).to_s } # Use ISO 8601 string format for date param

    let!(:auth) { setup_authentication(user:, space:) } # Use setup_authentication helper
    let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) } # Get headers from auth helper

    context 'when the request is successful' do
      let(:mock_operation_instance) { instance_double(Budgets::Operations::PrepareMonthlyReport) }
      let(:expected_operation_params) do
        # ActionController::Parameters are not directly comparable with Hashes.
        # We'll check for specific keys.
        hash_including(space_code: space.code, date: date_param)
      end

      before do
        allow(Budgets::Operations::PrepareMonthlyReport).to receive(:new).and_return(mock_operation_instance)
        allow(mock_operation_instance).to receive(:call)
          .with(expected_operation_params) # Use hash_including for params
          .and_return(Dry::Monads::Result::Success.new(report_data))

        get api_v1_budgets_path, params: { space_code: space.code, date: date_param }, headers: headers
      end

      it 'returns an HTTP status_ok' do
        expect(response).to have_http_status(:ok)
      end

      it 'calls the PrepareMonthlyReport operation with correct parameters' do
        # Expectation is set in the before block by allow(...).to receive(:call).with(...)
        # If it wasn't called or called with different params, the test would fail there.
        # For explicit verification, ensure it was called once.
        expect(mock_operation_instance).to have_received(:call).with(expected_operation_params).once
      end

      it 'returns the report data in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['data']).to eq(report_data.deep_stringify_keys)
      end
    end

    context 'when the PrepareMonthlyReport operation fails' do
      let(:mock_operation_instance) { instance_double(Budgets::Operations::PrepareMonthlyReport) }
      let(:failure_details_from_operation) { { "base" => ["Something went wrong with the report"] } } # This is what the operation returns
      let(:expected_operation_params) do
        hash_including(space_code: space.code, date: date_param)
      end

      before do
        allow(Budgets::Operations::PrepareMonthlyReport).to receive(:new).and_return(mock_operation_instance)
        allow(mock_operation_instance).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Failure.new(failure_details_from_operation))

        get api_v1_budgets_path, params: { space_code: space.code, date: date_param }, headers: headers
      end

      it 'returns an HTTP status_unprocessable_content' do
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'returns the failure details nested under error.details in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq("Unprocessable Entity")
        expect(json_response['error']['details']).to eq(failure_details_from_operation)
      end
    end

    # Add context for unauthenticated requests if ApiController handles authentication.
    # context 'when the request is unauthenticated' do
    #   before do
    #     get api_v1_budgets_path, params: { space_code: space.code, date: date_param }, headers: { 'Accept' => 'application/json' }
    #   end
    #
    #   it 'returns an HTTP status_unauthorized' do
    #     expect(response).to have_http_status(:unauthorized)
    #   end
    # end
  end

  describe 'PUT /api/v1/budgets/:id' do
    let!(:user) { create(:user) }
    let!(:space) { create(:space) }
    let!(:budget) { create(:budget, space: space, amount: 100.0) } # Pass space to budget factory

    let(:updated_amount) { 150.0 }
    let(:valid_update_params) do
      {
        id: budget.id.to_s,
        amount: updated_amount.to_s # Ensure amount is a string for params
      }
    end
    # Prepare params as they would be structured in a request
    let(:request_params) { { budget: valid_update_params } }


    let!(:auth) { setup_authentication(user: user, space: space) } # Use setup_authentication helper
    let(:headers) { auth[:headers].merge({ 'Accept': 'application/json' }) } # Get headers from auth helper

    context 'when the request is successful' do
      let(:mock_update_operation_instance) { instance_double(Budgets::Operations::UpdateBudget) }
      # The operation is expected to return the budget object itself on success
      # let(:updated_budget_data) { budget.attributes.merge("amount" => updated_amount.to_s).deep_stringify_keys } # Old: was a hash

      # Expected params for the operation, including those added by with_current_params
      let(:expected_operation_params) do
        ActionController::Parameters.new(
          id: budget.id.to_s,
          amount: updated_amount.to_s # Amount will be a string from params
        )
        .permit(:id, :amount)
        .merge(user_id: user.id, space_id: space.id, space_code: space.code) # Use IDs
      end


      before do
        allow(Budgets::Operations::UpdateBudget).to receive(:new).and_return(mock_update_operation_instance)
        allow(mock_update_operation_instance).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Success.new(budget)) # Return the budget object

        # Stub class name for render_created message if budget is a double or complex object
        # allow(budget).to receive_message_chain(:class, :name, :demodulize).and_return("Budget")

        put api_v1_budget_path(budget), params: valid_update_params, headers: headers
      end

      it 'returns an HTTP status_created' do
        expect(response).to have_http_status(:created)
      end

      it 'calls the UpdateBudget operation with correct parameters' do
        expect(mock_update_operation_instance).to have_received(:call).with(expected_operation_params).once
      end

      it 'returns the id of the updated budget in the data and a success message' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['data']['id']).to eq(budget.id.to_s)
        # The default message from render_created uses record.class.name.demodulize
        # For a factory object like :budget, this should resolve to "Budget"
        expect(json_response['message']).to eq("Resource Budget created successfully")
      end
    end

    context 'when the UpdateBudget operation fails' do
      let(:mock_update_operation_instance) { instance_double(Budgets::Operations::UpdateBudget) }
      let(:failure_details_from_operation) { { "base" => ["Failed to update budget"] } }
      let(:expected_operation_params) do
        ActionController::Parameters.new(
          id: budget.id.to_s,
          amount: updated_amount.to_s # Amount will be a string from params
        ).permit(:id, :amount)
        .merge(user_id: user.id, space_id: space.id, space_code: space.code) # Use IDs
      end

      before do
        allow(Budgets::Operations::UpdateBudget).to receive(:new).and_return(mock_update_operation_instance)
        allow(mock_update_operation_instance).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Failure.new(failure_details_from_operation))

        put api_v1_budget_path(budget), params: valid_update_params, headers: headers
      end

      it 'returns an HTTP status_unprocessable_content' do
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'returns the failure details in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Unprocessable Entity')
        expect(json_response['error']['details']).to eq(failure_details_from_operation)
      end
    end

    # Consider adding context for invalid parameters (e.g., missing amount, non-existent budget ID)
    # if Budgets::Operations::UpdateBudget handles these through its own validation contract.
    # If the controller's update_params or with_current_params itself would raise an error before
    # calling the operation for fundamentally malformed requests, those scenarios could be tested here too.

    # context 'when the request is unauthenticated' do
    #   before do
    #     put api_v1_budget_path(budget), params: valid_update_params, headers: { 'Accept': 'application/json' }
    #   end
    #
    #   it 'returns an HTTP status_unauthorized' do
    #     expect(response).to have_http_status(:unauthorized)
    #   end
    # end
  end

  describe 'POST /api/v1/budgets' do
    let!(:user) { create(:user) }
    let!(:space) { create(:space) }
    let!(:category) { create(:category, space: space, name: "Test Category", category_type: "expense") }
    let(:test_date) { Date.today }

    let(:valid_create_params) do
      {
        category_name: category.name,
        space_id: space.id.to_s,
        amount: "100.0", # Amount as string
        date: test_date.to_s
      }
    end

    let!(:auth) { setup_authentication(user:, space:) }
    let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

    context 'when the request is successful' do
      let(:mock_create_operation_instance) { instance_double(Budgets::Operations::CreateBudget) }
      let(:created_budget) { create(:budget, space:, category:, date: test_date, amount: valid_create_params[:amount].to_f) }

      let(:expected_operation_params) do
        permitted_params = ActionController::Parameters.new(valid_create_params)
                                                     .permit(:category_name, :space_id, :amount, :date)
        permitted_params.merge(user_id: user.id, space_id: space.id, space_code: space.code)
      end

      before do
        allow(Budgets::Operations::CreateBudget).to receive(:new).and_return(mock_create_operation_instance)
        allow(mock_create_operation_instance).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Success.new(created_budget))

        post api_v1_budgets_path, params: valid_create_params, headers: headers
      end

      it 'returns an HTTP status_created' do
        expect(response).to have_http_status(:created)
      end

      it 'calls the CreateBudget operation with correct parameters' do
        expect(mock_create_operation_instance).to have_received(:call).with(expected_operation_params).once
      end

      it 'returns the id of the created budget in the data and a success message' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['data']['id']).to eq(created_budget.id.to_s)
        expect(json_response['message']).to eq("Resource Budget created successfully")
      end
    end

    context 'when the CreateBudget operation fails' do
      let(:mock_create_operation_instance) { instance_double(Budgets::Operations::CreateBudget) }
      let(:failure_details_from_operation) { { "base" => ["Failed to create budget"] } }
      let(:expected_operation_params) do
        permitted_params = ActionController::Parameters.new(valid_create_params)
                                                     .permit(:category_name, :space_id, :amount, :date)
        permitted_params.merge(user_id: user.id, space_id: space.id, space_code: space.code)
      end

      before do
        allow(Budgets::Operations::CreateBudget).to receive(:new).and_return(mock_create_operation_instance)
        allow(mock_create_operation_instance).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Failure.new(failure_details_from_operation))

        post api_v1_budgets_path, params: valid_create_params, headers: headers
      end

      it 'returns an HTTP status_unprocessable_content' do
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'returns the failure details in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Unprocessable Entity')
        expect(json_response['error']['details']).to eq(failure_details_from_operation)
      end
    end

    # Add context for unauthenticated requests if ApiController handles authentication.
    # context 'when the request is unauthenticated' do
    #   before do
    #     post api_v1_budgets_path, params: valid_create_params, headers: { 'Accept' => 'application/json' }
    #   end
    #
    #   it 'returns an HTTP status_unauthorized' do
    #     expect(response).to have_http_status(:unauthorized)
    #   end
    # end
  end

  describe 'DELETE /api/v1/budgets/:id' do
    let!(:user) { create(:user) }
    let!(:space) { create(:space) }
    let!(:budget_to_delete) { create(:budget, space: space) } # Ensure budget is associated with the space

    let!(:auth) { setup_authentication(user:, space:) }
    let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

    context 'when the budget exists and belongs to the current space' do
      before do
        # No need to mock Budget.find_by or destroy if we are testing the actual database interaction
        # and the setup_authentication ensures the current_user context is correct for any internal checks.
        delete api_v1_budget_path(budget_to_delete), headers: headers
      end

      it 'returns an HTTP status_ok' do
        expect(response).to have_http_status(:ok)
      end

      it 'returns a success message' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['message']).to eq('Budget deleted successfully')
      end

      it 'deletes the budget from the database' do
        expect(Budget).not_to exist(budget_to_delete.id)
      end
    end

    context 'when the budget does not exist' do
      before do
        delete api_v1_budget_path('non-existent-id'), headers: headers
      end

      it 'returns an HTTP status_not_found' do
        expect(response).to have_http_status(:not_found)
      end

      it 'returns a not found message' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Resource not found')
        expect(json_response['error']['details']).to eq('Budget not found')
      end
    end

    # Optional: Add a context if budgets could exist but not belong to the current user's space,
    # and if there's a specific authorization check for that beyond just find_by(id:).
    # This depends on whether ApiController or a before_action handles such authorization.
    # For simplicity, assuming find_by(id: params[:id]) is the primary check for existence.

    # Add context for unauthenticated requests if ApiController handles authentication.
    # context 'when the request is unauthenticated' do
    #   before do
    #     delete api_v1_budget_path(budget_to_delete), headers: { 'Accept' => 'application/json' }
    #   end
    #
    #   it 'returns an HTTP status_unauthorized' do
    #     expect(response).to have_http_status(:unauthorized)
    #   end
    # end
  end
end
