# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Dashboards', type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }

  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

  describe 'GET /api/v1/dashboard' do
    let(:dashboard_data_query_output) do
      # Mock a space object that responds to necessary methods
      instance_double(Spaces::Space,
                          goal_description: instance_double(GoalDescription, description: 'Some goal description', id: 'goal-1'),
                          categories: [instance_double(Transactions::Category, name: 'Category1')],
                          expense_categories: [instance_double(Transactions::Category, name: 'ExpenseCategory1')],
                          income_categories: [instance_double(Transactions::Category, name: 'IncomeCategory1')],
                          accounts: double(kept: [instance_double(Transactions::Account, name: 'Account1', id: 'account-1')]),
                          id: space.id)
    end

    # Define the expected serialized data with camelCase keys
    let(:expected_serialized_dashboard_data) do
      {
        'id' => space.id,
        'goalDescription' => 'Some goal description',
        'categoryOptions' => [{ 'label' => 'Category1', 'value' => 'Category1' }],
        'expenseCategoryOptions' => [{ 'label' => 'ExpenseCategory1', 'value' => 'ExpenseCategory1' }],
        'incomeCategoryOptions' => [{ 'label' => 'IncomeCategory1', 'value' => 'IncomeCategory1' }],
        'accountOptions' => [{ 'label' => 'Account1', 'value' => 'Account1' }]
      }
    end

    let(:expected_query_params) do
      hash_including(space_code: space.code)
    end

    context 'when the query is successful' do
      let(:mock_dashboard_data_query) { instance_double(Spaces::Queries::DashboardData) }

      before do
        allow(Spaces::Queries::DashboardData).to receive(:call).and_return(Dry::Monads::Result::Success.new(dashboard_data_query_output))

        get api_v1_dashboard_path, params: { space_code: space.code }, headers: headers
      end

      it 'returns an HTTP status_ok' do
        expect(response).to have_http_status(:ok)
      end

      it 'calls the DashboardData query with correct parameters' do
        expect(Spaces::Queries::DashboardData).to have_received(:call).with(params: expected_query_params).once
      end

      it 'returns the dashboard data in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['data']['dashboard']).to eq(expected_serialized_dashboard_data)
      end
    end

    context 'when the DashboardData query fails' do
      let(:failure_details_from_query) { { 'base' => ['Failed to retrieve dashboard data'] } }

      before do
        allow(Spaces::Queries::DashboardData).to receive(:call).and_return(Dry::Monads::Result::Failure.new(failure_details_from_query))

        get api_v1_dashboard_path, params: { space_code: space.code }, headers: headers
      end

      it 'returns an HTTP status_internal_server_error' do
        expect(response).to have_http_status(:internal_server_error)
      end

      it 'returns the failure details in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Internal Server Error')
        expect(json_response['error']['details']).to eq(failure_details_from_query)
      end
    end

    context 'when the request is unauthenticated' do
      before do
        get api_v1_dashboard_path, params: { space_code: space.code }, headers: { 'Accept' => 'application/json' }
      end

      it 'returns an HTTP status_unauthorized' do
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/dashboard/reset_data' do
    let(:expected_operation_params) do
      {
        space_code: space.code,
        user_id: user.id,
        space_id: space.id
      }
    end

    let(:mock_reset_data_operation) { instance_double(Spaces::Operations::ResetData) }

    context 'when the operation is successful' do
      before do
        allow(Spaces::Operations::ResetData).to receive(:new).and_return(mock_reset_data_operation)
        allow(mock_reset_data_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new({ message: 'Data reset successfully' }))

        post reset_data_api_v1_dashboard_path, params: { space_code: space.code }, headers: headers
      end

      it 'returns an HTTP status_ok' do
        expect(response).to have_http_status(:ok)
      end

      it 'calls the ResetData operation with correct parameters' do
        expect(mock_reset_data_operation).to have_received(:call).with(expected_operation_params).once
      end

      it 'returns a success message in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['message']).to eq('Success')
        expect(json_response['data']['message']).to eq('Data reset successfully')
      end
    end

    context 'when the ResetData operation fails' do
      let(:failure_details_from_operation) { { 'base' => ['Failed to reset data'] } }
      let(:mock_reset_data_operation) { instance_double(Spaces::Operations::ResetData) }

      before do
        allow(Spaces::Operations::ResetData).to receive(:new).and_return(mock_reset_data_operation)
        allow(mock_reset_data_operation).to receive(:call).and_return(Dry::Monads::Result::Failure.new(failure_details_from_operation))

        post reset_data_api_v1_dashboard_path, params: { space_code: space.code }, headers: headers
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

    context 'when the request is unauthenticated' do
      before do
        post reset_data_api_v1_dashboard_path, params: { space_code: space.code }, headers: { 'Accept' => 'application/json' }
      end

      it 'returns an HTTP status_unauthorized' do
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
