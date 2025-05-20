# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Insights', type: :request do
  describe 'GET /api/v1/insights' do
    let!(:user) { create(:user) }
    let!(:space) { create(:personal_space, users: [user]) } # Assuming personal_space or similar factory

    let!(:auth) { setup_authentication(user:, space:) }
    let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

    let(:insights_operation_output) do
      {
        data: {
          totalIncome: "PHP10,000.00",
          totalExpenses: "PHP5,000.00",
          netSavings: "PHP5,000.00"
        },
        message: "Insights data generated successfully"
      }
    end

    let(:request_params) { { space_code: space.code, start_date: '2024-01-01', end_date: '2024-01-31' } }

    context 'when the request is successful' do
      let(:mock_insights_operation) { instance_double(Insights::Operations::CreateInsightsData) }
      let(:expected_operation_params) do
        # Parameters passed to with_current_params are ActionController::Parameters
        # that permit category_name, start_date, end_date.
        # with_current_params adds user_id, space_id, space_code.
        ac_params = ActionController::Parameters.new(
          start_date: request_params[:start_date],
          end_date: request_params[:end_date]
          # category_name is optional, so not included in this base case
        ).permit(:category_name, :start_date, :end_date)

        ac_params.merge(
          user_id: user.id,
          space_id: space.id,
          space_code: space.code
        )
      end

      before do
        allow(Insights::Operations::CreateInsightsData).to receive(:new).and_return(mock_insights_operation)
        allow(mock_insights_operation).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Success.new(insights_operation_output))

        get api_v1_insights_path, params: request_params, headers: headers
      end

      it 'returns an HTTP status_ok' do
        expect(response).to have_http_status(:ok)
      end

      it 'calls the CreateInsightsData operation with correct parameters' do
        expect(mock_insights_operation).to have_received(:call).with(expected_operation_params).once
      end

      it 'returns the insights data in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['message']).to eq('Success')
        expect(json_response['data']).to eq(insights_operation_output.deep_stringify_keys)
      end
    end

    context 'when the CreateInsightsData operation fails' do
      let(:mock_insights_operation) { instance_double(Insights::Operations::CreateInsightsData) }
      let(:failure_details) { { "error" => "Failed to generate insights" } }
      let(:expected_operation_params) do
        ac_params = ActionController::Parameters.new(
          start_date: request_params[:start_date],
          end_date: request_params[:end_date]
        ).permit(:category_name, :start_date, :end_date)

        ac_params.merge(
          user_id: user.id,
          space_id: space.id,
          space_code: space.code
        )
      end

      before do
        allow(Insights::Operations::CreateInsightsData).to receive(:new).and_return(mock_insights_operation)
        allow(mock_insights_operation).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Failure.new(failure_details))

        get api_v1_insights_path, params: request_params, headers: headers
      end

      it 'returns an HTTP status_internal_server_error' do
        expect(response).to have_http_status(:internal_server_error)
      end

      it 'returns the failure details in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Internal Server Error')
        expect(json_response['error']['details']).to eq(failure_details.deep_stringify_keys)
      end
    end

    context 'when optional category_name parameter is provided' do
      let(:mock_insights_operation) { instance_double(Insights::Operations::CreateInsightsData) }
      let(:request_params_with_category) { request_params.merge(category_name: 'Food') }
      let(:expected_operation_params_with_category) do
        ac_params = ActionController::Parameters.new(
          start_date: request_params_with_category[:start_date],
          end_date: request_params_with_category[:end_date],
          category_name: request_params_with_category[:category_name]
        ).permit(:category_name, :start_date, :end_date)

        ac_params.merge(
          user_id: user.id,
          space_id: space.id,
          space_code: space.code
        )
      end

      before do
        allow(Insights::Operations::CreateInsightsData).to receive(:new).and_return(mock_insights_operation)
        allow(mock_insights_operation).to receive(:call)
          .with(expected_operation_params_with_category)
          .and_return(Dry::Monads::Result::Success.new(insights_operation_output))

        get api_v1_insights_path, params: request_params_with_category, headers: headers
      end

      it 'calls the CreateInsightsData operation with category_name' do
        expect(mock_insights_operation).to have_received(:call).with(expected_operation_params_with_category).once
        expect(response).to have_http_status(:ok) # Ensure it still succeeds
      end
    end

    context 'when the request is unauthenticated' do
      before do
        get api_v1_insights_path, params: request_params, headers: { 'Accept' => 'application/json' } # No auth headers
      end

      it 'returns an HTTP status_unauthorized' do
        # This assumes ApiController or a before_action handles authentication and returns 401
        # The exact response body can be checked if a standard unauth response is established
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
