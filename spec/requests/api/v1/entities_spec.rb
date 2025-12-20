# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Entities', type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }

  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

  describe 'GET /api/v1/entities' do
    let(:mock_show_entities_operation) { instance_double(Entities::Operations::ShowEntities) }
    let(:entities_data) do
      [
        {
          id: 1,
          full_name: 'Test Lender',
          entity_type: 'loan'
        }
      ]
    end

    context 'when the request is successful' do
      let(:expected_operation_params) do
        hash_including(
          space_id: space.id.to_s,
          user_id: user.id,
          space_code: space.code,
          entity_type: 'loan'
        )
      end

      before do
        allow(Entities::Operations::ShowEntities).to receive(:new).and_return(mock_show_entities_operation)
        allow(mock_show_entities_operation).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Success.new(entities_data))

        get api_v1_entities_path, params: { space_code: space.code }, headers: headers
      end

      it 'returns an HTTP status_ok' do
        expect(response).to have_http_status(:ok)
      end

      it 'calls the ShowEntities operation with correct parameters' do
        expect(mock_show_entities_operation).to have_received(:call).with(expected_operation_params).once
      end

      it 'returns the entities data in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['data']).to be_present
      end
    end

    context 'when the request includes entity_type parameter' do
      let(:expected_operation_params) do
        hash_including(
          space_id: space.id.to_s,
          user_id: user.id,
          space_code: space.code,
          entity_type: 'loan'
        )
      end

      before do
        allow(Entities::Operations::ShowEntities).to receive(:new).and_return(mock_show_entities_operation)
        allow(mock_show_entities_operation).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Success.new(entities_data))

        get api_v1_entities_path, params: { space_code: space.code, entity_type: 'loan' }, headers: headers
      end

      it 'calls the ShowEntities operation with the provided entity_type' do
        expect(mock_show_entities_operation).to have_received(:call).with(expected_operation_params).once
      end
    end

    context 'when the request includes search parameter' do
      let(:expected_operation_params) do
        hash_including(
          space_id: space.id.to_s,
          user_id: user.id,
          space_code: space.code,
          entity_type: 'loan',
          search: 'Test'
        )
      end

      before do
        allow(Entities::Operations::ShowEntities).to receive(:new).and_return(mock_show_entities_operation)
        allow(mock_show_entities_operation).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Success.new(entities_data))

        get api_v1_entities_path, params: { space_code: space.code, search: 'Test' }, headers: headers
      end

      it 'calls the ShowEntities operation with the search parameter' do
        expect(mock_show_entities_operation).to have_received(:call).with(expected_operation_params).once
      end
    end

    context 'when the ShowEntities operation fails' do
      let(:failure_details_from_operation) { { 'base' => ['Failed to retrieve entities'] } }
      let(:expected_operation_params) do
        hash_including(
          space_id: space.id.to_s,
          user_id: user.id,
          space_code: space.code,
          entity_type: 'loan'
        )
      end

      before do
        allow(Entities::Operations::ShowEntities).to receive(:new).and_return(mock_show_entities_operation)
        allow(mock_show_entities_operation).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Failure.new(failure_details_from_operation))

        get api_v1_entities_path, params: { space_code: space.code }, headers: headers
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
        get api_v1_entities_path, params: { space_code: space.code }, headers: { 'Accept' => 'application/json' }
      end

      it 'returns an HTTP status_unauthorized' do
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/entities' do
    let(:mock_create_entity_operation) { instance_double(Entities::Operations::CreateEntity) }
    let(:valid_create_params) do
      {
        full_name: 'Test Lender',
        entity_type: 'loan'
      }
    end

    let(:created_entity) do
      create(
        :entity,
        space: space,
        full_name: valid_create_params[:full_name],
        entity_type: valid_create_params[:entity_type]
      )
    end

    context 'when the request is successful' do
      let(:expected_operation_params) do
        hash_including(
          space_id: space.id.to_s,
          user_id: user.id,
          space_code: space.code,
          full_name: valid_create_params[:full_name],
          entity_type: valid_create_params[:entity_type]
        )
      end

      before do
        allow(Entities::Operations::CreateEntity).to receive(:new).and_return(mock_create_entity_operation)
        allow(mock_create_entity_operation).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Success.new(created_entity))

        post api_v1_entities_path, params: valid_create_params.merge(space_code: space.code), headers: headers
      end

      it 'returns an HTTP status_created' do
        expect(response).to have_http_status(:created)
      end

      it 'calls the CreateEntity operation with correct parameters' do
        expect(mock_create_entity_operation).to have_received(:call).with(expected_operation_params).once
      end

      it 'returns the created entity data in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['data']).to be_present
        expect(json_response['message']).to eq("Resource created successfully")
      end
    end

    context 'when the CreateEntity operation fails' do
      let(:failure_details_from_operation) { { 'base' => ['Failed to create entity'] } }
      let(:expected_operation_params) do
        hash_including(
          space_id: space.id.to_s,
          user_id: user.id,
          space_code: space.code,
          full_name: valid_create_params[:full_name],
          entity_type: valid_create_params[:entity_type]
        )
      end

      before do
        allow(Entities::Operations::CreateEntity).to receive(:new).and_return(mock_create_entity_operation)
        allow(mock_create_entity_operation).to receive(:call)
          .with(expected_operation_params)
          .and_return(Dry::Monads::Result::Failure.new(failure_details_from_operation))

        post api_v1_entities_path, params: valid_create_params.merge(space_code: space.code), headers: headers
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
        post api_v1_entities_path, params: valid_create_params.merge(space_code: space.code), headers: { 'Accept' => 'application/json' }
      end

      it 'returns an HTTP status_unauthorized' do
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
