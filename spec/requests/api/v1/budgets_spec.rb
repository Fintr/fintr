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

      it 'returns an HTTP status_internal_server_error' do
        expect(response).to have_http_status(:internal_server_error)
      end

      it 'returns the failure details nested under error.details in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq("Internal Server Error")
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
        id: budget.id.to_s, # Ensure ID is a string if that's what the controller expects
        amount: updated_amount
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
        ).permit(:id, :amount)
                                  .merge(user_id: user.id, space_id: space.id) # Use IDs
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
                                  .merge(user_id: user.id, space_id: space.id) # Use IDs
      end

      before do
        allow(Budgets::Operations::UpdateBudget).to receive(:new).and_return(mock_update_operation_instance)
        allow(mock_update_operation_instance).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Failure.new(failure_details_from_operation))

        put api_v1_budget_path(budget), params: valid_update_params, headers: headers
      end

      it 'returns an HTTP status_internal_server_error' do
        expect(response).to have_http_status(:internal_server_error)
      end

      it 'returns the failure details in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Internal Server Error') # Or your specific error message
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
end
