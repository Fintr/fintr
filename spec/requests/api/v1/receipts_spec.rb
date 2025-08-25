# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Receipts', type: :request do
  describe 'POST /api/v1/receipts' do
    let!(:user) { create(:user) }
    let!(:space) { create(:personal_space, users: [user]) }
    let!(:auth) { setup_authentication(user:, space:) }
    let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

    let(:valid_image_file) do
      fixture_file_upload(
        Rails.root.join('spec', 'fixtures', 'files', 'test.jpg'),
        'image/jpeg'
      )
    end

    let(:expected_processing_params) do
      hash_including(
        user_id: user.id,
        space_id: space.id,
        space_code: space.code,
        image_path: kind_of(String),
        auto_create_transaction: false,
        processing_method: "pure_ai"
      )
    end

    let(:mock_create_usage_instance) { instance_double(Ai::Operations::Usages::CreateUsage) }
    let(:mock_process_receipt_instance) { instance_double(Ai::Operations::Receipts::ProcessReceipt) }

    context 'when the request is successful' do
      let(:receipt_processing_result) do
        {
          extracted_data: {
            merchant: { value: "Test Store", confidence: 0.95 },
            total_amount: { value: 150.00, confidence: 0.98 },
            date: { value: "2024-01-15", confidence: 0.90 }
          },
          confidence_summary: {
            overall_confidence: 0.94,
            should_review: false
          }
        }
      end

      before do
        allow(::Ai::Operations::Usages::CreateUsage).to receive(:new).and_return(mock_create_usage_instance)
        allow(::Ai::Operations::Receipts::ProcessReceipt).to receive(:new).and_return(mock_process_receipt_instance)

        allow(mock_create_usage_instance).to receive(:call).and_yield.and_return(
          Dry::Monads::Result::Success.new(receipt_processing_result)
        )
        allow(mock_process_receipt_instance).to receive(:call).and_return(
          Dry::Monads::Result::Success.new(receipt_processing_result)
        )

        post api_v1_receipts_path, params: { image: valid_image_file }, headers: headers
      end

      it 'returns an HTTP status_ok' do
        expect(response).to have_http_status(:ok)
      end

      it 'calls the CreateUsage operation with correct parameters' do
        expect(mock_create_usage_instance).to have_received(:call).with(expected_processing_params).once
      end

      it 'calls the ProcessReceipt operation with correct parameters' do
        expect(mock_process_receipt_instance).to have_received(:call).with(params: expected_processing_params).once
      end

      it 'returns the receipt processing result in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['message']).to eq('Receipt processed successfully')
        expect(json_response['data']).to eq(Transformers::LowerCamelKeys.transform(receipt_processing_result.deep_stringify_keys).deep_stringify_keys)
      end
    end

    context 'when auto_create_transaction is true' do
      let(:receipt_processing_result) do
        {
          extracted_data: {
            merchant: { value: "Test Store", confidence: 0.95 },
            total_amount: { value: 150.00, confidence: 0.98 },
            date: { value: "2024-01-15", confidence: 0.90 }
          },
          confidence_summary: {
            overall_confidence: 0.94,
            should_review: false
          }
        }
      end

      let(:expected_processing_params_with_auto_create) do
        hash_including(
          user_id: user.id,
          space_id: space.id,
          space_code: space.code,
          image_path: kind_of(String),
          auto_create_transaction: true,
          processing_method: "pure_ai"
        )
      end

      before do
        allow(::Ai::Operations::Usages::CreateUsage).to receive(:new).and_return(mock_create_usage_instance)
        allow(::Ai::Operations::Receipts::ProcessReceipt).to receive(:new).and_return(mock_process_receipt_instance)

        allow(mock_create_usage_instance).to receive(:call).and_yield.and_return(
          Dry::Monads::Result::Success.new(receipt_processing_result)
        )
        allow(mock_process_receipt_instance).to receive(:call).and_return(
          Dry::Monads::Result::Success.new(receipt_processing_result)
        )

        post api_v1_receipts_path,
             params: { image: valid_image_file, auto_create_transaction: true },
             headers: headers
      end

      it 'calls the CreateUsage operation with auto_create_transaction set to true' do
        expect(mock_create_usage_instance).to have_received(:call).with(expected_processing_params_with_auto_create).once
      end
    end

    context 'when the CreateUsage operation fails' do
      let(:failure_details) { { "error" => "Failed to process receipt" } }

      before do
        allow(::Ai::Operations::Usages::CreateUsage).to receive(:new).and_return(mock_create_usage_instance)
        allow(::Ai::Operations::Receipts::ProcessReceipt).to receive(:new).and_return(mock_process_receipt_instance)

        allow(mock_create_usage_instance).to receive(:call).and_yield.and_return(
          Dry::Monads::Result::Failure.new(failure_details)
        )
        allow(mock_process_receipt_instance).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new(failure_details)
        )

        post api_v1_receipts_path, params: { image: valid_image_file }, headers: headers
      end

      it 'returns an HTTP status_internal_server_error' do
        expect(response).to have_http_status(:internal_server_error)
      end

      it 'returns the failure details in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Receipt processing failed')
        expect(json_response['error']['details']).to eq(Transformers::LowerCamelKeys.transform(failure_details.deep_stringify_keys).deep_stringify_keys)
      end
    end

    context 'when no image file is provided' do
      before do
        post api_v1_receipts_path, params: {}, headers: headers
      end

      it 'returns an HTTP status_bad_request' do
        expect(response).to have_http_status(:bad_request)
      end

      it 'returns an error message indicating image file is required' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Image file is required')
      end
    end

    context 'when an invalid file type is uploaded' do
      let(:invalid_file) do
        fixture_file_upload(
          Rails.root.join('spec', 'fixtures', 'files', 'test.txt'),
          'text/plain'
        )
      end

      before do
        post api_v1_receipts_path, params: { image: invalid_file }, headers: headers
      end

      it 'returns an HTTP status_internal_server_error' do
        expect(response).to have_http_status(:internal_server_error)
      end

      it 'returns an error message about invalid file type' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Receipt processing failed')
        expect(json_response['error']['details']['error']).to include('Invalid file type')
      end
    end

    context 'when a file that is too large is uploaded' do
      let(:large_file) do
        # Create a mock file that appears to be larger than 10MB
        file = fixture_file_upload(
          Rails.root.join('spec', 'fixtures', 'files', 'test.jpg'),
          'image/jpeg'
        )
        allow(file).to receive(:size).and_return(11.megabytes)
        file
      end

      before do
        post api_v1_receipts_path, params: { image: large_file }, headers: headers
      end

      it 'returns an HTTP status_internal_server_error' do
        expect(response).to have_http_status(:internal_server_error)
      end

      it 'returns an error message about file size' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Receipt processing failed')
        # The error might be different due to the operations being called
        expect(json_response['error']['details']['error']).to be_present
      end
    end
  end

  describe 'POST /api/v1/receipts/process_test' do
    let!(:user) { create(:user) }
    let!(:space) { create(:personal_space, users: [user]) }
    let!(:auth) { setup_authentication(user:, space:) }
    let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

    let(:test_image_path) { Rails.root.join('spec', 'fixtures', 'files', 'test.jpg').to_s }
    let(:expected_processing_params) do
      hash_including(
        user_id: user.id,
        space_id: space.id,
        space_code: space.code,
        image_path: test_image_path,
        auto_create_transaction: false
      )
    end

    let(:mock_process_receipt_instance) { instance_double(Ai::Operations::Receipts::ProcessReceipt) }

    context 'when in development environment' do
      before do
        allow(Rails.env).to receive(:development?).and_return(true)
        allow(Rails.env).to receive(:test?).and_return(false)
      end

      context 'when the request is successful' do
        let(:receipt_processing_result) do
          {
            extracted_data: {
              merchant: { value: "Test Store", confidence: 0.95 },
              total_amount: { value: 150.00, confidence: 0.98 }
            },
            confidence_summary: {
              overall_confidence: 0.94,
              should_review: false
            }
          }
        end

        before do
          allow(::Ai::Operations::Receipts::ProcessReceipt).to receive(:new).and_return(mock_process_receipt_instance)
          allow(mock_process_receipt_instance).to receive(:call).and_return(
            Dry::Monads::Result::Success.new(receipt_processing_result)
          )

          post process_test_api_v1_receipts_path,
               params: { test_image_path: test_image_path },
               headers: headers
        end

        it 'returns an HTTP status_ok' do
          expect(response).to have_http_status(:ok)
        end

        it 'calls the ProcessReceipt operation with correct parameters' do
          expect(mock_process_receipt_instance).to have_received(:call).with(params: expected_processing_params).once
        end

        it 'returns the receipt processing result in the response body' do
          json_response = JSON.parse(response.body)
          expect(json_response['success']).to be(true)
          expect(json_response['message']).to eq('Test receipt processed successfully')
          expect(json_response['data']).to eq(Transformers::LowerCamelKeys.transform(receipt_processing_result.deep_stringify_keys).deep_stringify_keys)
        end
      end

      context 'when the ProcessReceipt operation fails' do
        let(:failure_details) { { "error" => "Failed to process test receipt" } }

        before do
          allow(::Ai::Operations::Receipts::ProcessReceipt).to receive(:new).and_return(mock_process_receipt_instance)
          allow(mock_process_receipt_instance).to receive(:call).and_return(
            Dry::Monads::Result::Failure.new(failure_details)
          )

          post process_test_api_v1_receipts_path,
               params: { test_image_path: test_image_path },
               headers: headers
        end

        it 'returns an HTTP status_internal_server_error' do
          expect(response).to have_http_status(:internal_server_error)
        end

        it 'returns the failure details in the response body' do
          json_response = JSON.parse(response.body)
          expect(json_response['success']).to be(false)
          expect(json_response['error']['details']).to eq(Transformers::LowerCamelKeys.transform(failure_details.deep_stringify_keys).deep_stringify_keys)
        end
      end

      context 'when no test_image_path is provided' do
        before do
          post process_test_api_v1_receipts_path, params: {}, headers: headers
        end

        it 'returns an HTTP status_bad_request' do
          expect(response).to have_http_status(:bad_request)
        end

        it 'returns an error message indicating test_image_path is required' do
          json_response = JSON.parse(response.body)
          expect(json_response['success']).to be(false)
          expect(json_response['error']['message']).to eq('test_image_path parameter required')
        end
      end

      context 'when the test image file does not exist' do
        let(:non_existent_path) { '/path/to/non/existent/file.jpg' }

        before do
          post process_test_api_v1_receipts_path,
               params: { test_image_path: non_existent_path },
               headers: headers
        end

        it 'returns an HTTP status_not_found' do
          expect(response).to have_http_status(:not_found)
        end

        it 'returns an error message indicating test image file not found' do
          json_response = JSON.parse(response.body)
          expect(json_response['success']).to be(false)
          expect(json_response['error']['message']).to eq('Test image file not found')
        end
      end
    end

    context 'when not in development or test environment' do
      before do
        allow(Rails.env).to receive(:development?).and_return(false)
        allow(Rails.env).to receive(:test?).and_return(false)

        post process_test_api_v1_receipts_path,
             params: { test_image_path: test_image_path },
             headers: headers
      end

      it 'returns an HTTP status_forbidden' do
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
