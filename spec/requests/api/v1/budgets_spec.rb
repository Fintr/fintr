# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Budgets', type: :request do
  describe 'GET /api/v1/budgets' do
    let!(:user) { create(:user) } # Assuming a user factory exists
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
end
