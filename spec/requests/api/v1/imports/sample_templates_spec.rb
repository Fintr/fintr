# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Imports::SampleTemplates', type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }

  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

  describe 'GET /api/v1/imports/sample_template' do
    let(:mock_generate_sample_template_operation) { instance_double(Imports::Operations::GenerateSampleTemplate) }
    let(:file_path) { Rails.root.join('tmp', "import_template_#{SecureRandom.hex(8)}.xlsx") }
    let(:operation_result) { { file_path: file_path.to_s } }

    before do
      # Ensure tmp directory exists
      FileUtils.mkdir_p(Rails.root.join('tmp'))
    end

    after do
      # Clean up test files
      File.delete(file_path) if File.exist?(file_path)
    end

    context 'when the request is successful' do
      before do
        # Create a temporary file for testing
        FileUtils.touch(file_path)

        allow(Imports::Operations::GenerateSampleTemplate).to receive(:new).and_return(mock_generate_sample_template_operation)
        allow(mock_generate_sample_template_operation).to receive(:call)
          .with(space_id: space.id)
          .and_return(Dry::Monads::Result::Success.new(operation_result))

        get api_v1_imports_sample_template_path, headers: headers
      end

      it 'returns an HTTP status_ok' do
        expect(response).to have_http_status(:ok)
      end

      it 'calls the GenerateSampleTemplate operation with correct parameters' do
        expect(mock_generate_sample_template_operation).to have_received(:call).with(space_id: space.id).once
      end

      it 'sends the file with correct content type' do
        expect(response.content_type).to include('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      end

      it 'sends the file with correct filename' do
        expect(response.headers['Content-Disposition']).to include('attachment')
        expect(response.headers['Content-Disposition']).to include('filename="import_template.xlsx"')
      end
    end

    context 'when the GenerateSampleTemplate operation fails' do
      let(:failure_details_from_operation) { { error: 'Space not found' } }

      before do
        allow(Imports::Operations::GenerateSampleTemplate).to receive(:new).and_return(mock_generate_sample_template_operation)
        allow(mock_generate_sample_template_operation).to receive(:call)
          .with(space_id: space.id)
          .and_return(Dry::Monads::Result::Failure.new(failure_details_from_operation))

        get api_v1_imports_sample_template_path, headers: headers
      end

      it 'returns an HTTP status_unprocessable_content' do
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'returns the failure details in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Unprocessable Entity')
        expect(json_response['error']['details']).to eq(failure_details_from_operation.stringify_keys)
      end
    end

    context 'when the operation returns a failure as a string' do
      let(:failure_string) { 'Operation failed' }

      before do
        allow(Imports::Operations::GenerateSampleTemplate).to receive(:new).and_return(mock_generate_sample_template_operation)
        allow(mock_generate_sample_template_operation).to receive(:call)
          .with(space_id: space.id)
          .and_return(Dry::Monads::Result::Failure.new(failure_string))

        get api_v1_imports_sample_template_path, headers: headers
      end

      it 'returns an HTTP status_unprocessable_content' do
        expect(response).to have_http_status(:unprocessable_content)
      end

      it 'returns the failure message in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Unprocessable Entity')
        expect(json_response['error']['details']['error']).to eq(failure_string)
      end
    end

    context 'when the generated file does not exist' do
      let(:non_existent_file_path) { Rails.root.join('tmp', "non_existent_#{SecureRandom.hex(8)}.xlsx") }
      let(:operation_result_with_missing_file) { { file_path: non_existent_file_path.to_s } }

      before do
        allow(Imports::Operations::GenerateSampleTemplate).to receive(:new).and_return(mock_generate_sample_template_operation)
        allow(mock_generate_sample_template_operation).to receive(:call)
          .with(space_id: space.id)
          .and_return(Dry::Monads::Result::Success.new(operation_result_with_missing_file))

        get api_v1_imports_sample_template_path, headers: headers
      end

      it 'returns an HTTP status_internal_server_error' do
        expect(response).to have_http_status(:internal_server_error)
      end

      it 'returns an error message indicating file not found' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Internal Server Error')
        expect(json_response['error']['details']['error']).to eq('Generated file not found')
      end
    end

    context 'when the operation raises a StandardError' do
      before do
        allow(Imports::Operations::GenerateSampleTemplate).to receive(:new).and_return(mock_generate_sample_template_operation)
        allow(mock_generate_sample_template_operation).to receive(:call)
          .with(space_id: space.id)
          .and_raise(StandardError.new('Unexpected error'))

        get api_v1_imports_sample_template_path, headers: headers
      end

      it 'returns an HTTP status_internal_server_error' do
        expect(response).to have_http_status(:internal_server_error)
      end

      it 'returns the error message in the response body' do
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Internal Server Error')
        expect(json_response['error']['details']['error']).to eq('Unexpected error')
      end
    end

    context 'when the request is unauthenticated' do
      before do
        get api_v1_imports_sample_template_path, headers: { 'Accept' => 'application/json' }
      end

      it 'returns an HTTP status_unauthorized' do
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
