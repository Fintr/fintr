# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Imports::ImportRecords', type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers].merge({ 'Accept' => 'application/json' }) }

  let!(:import) do
    Imports::Import.create!(
      user: user,
      space: space,
      import_location: 'settings',
      status: 'completed',
      total_rows_read: 10,
      total_rows_inserted: 8,
      total_rows_failed: 2
    )
  end

  let!(:import_record) do
    Imports::ImportRecord.create!(
      import: import,
      row_number: 1,
      status: 'failed',
      original_data: {
        date: '2024-01-15',
        description: 'Test transaction',
        amount: 100.00,
        type: 'expense',
        category: 'Food'
      }
    )
  end

  describe 'GET /api/v1/imports/imports/:import_id/import_records' do
    let(:mock_query) { instance_double(Imports::Queries::ListImportRecords) }
    let(:query_result) { double("query_result", current_page: 1, total_pages: 1, total_count: 1) } # rubocop:disable RSpec/VerifiedDoubles

    context 'when the request is successful' do
      before do
        allow(Imports::Queries::ListImportRecords).to receive(:new).and_return(mock_query)
        allow(mock_query).to receive(:call).and_return(
          Dry::Monads::Result::Success.new(query_result)
        )
        allow(Imports::Serializers::ImportRecordSerializer).to receive(:render_as_hash).and_return([
          {
            id: import_record.id.to_s,
            rowNumber: 1,
            status: 'failed',
            originalData: import_record.original_data
          }
        ])
      end

      it 'returns an HTTP status_ok' do
        get "/api/v1/imports/imports/#{import.id}/import_records", headers: headers

        expect(response).to have_http_status(:ok)
      end

      it 'calls ListImportRecords query with correct parameters' do
        get "/api/v1/imports/imports/#{import.id}/import_records",
            params: { page: 1, per_page: 10, status: 'failed' },
            headers: headers

        expect(Imports::Queries::ListImportRecords).to have_received(:new).with(
          hash_including(
            import_id: import.id.to_s,
            page: '1',
            per_page: '10',
            status: 'failed'
          )
        )
      end

      it 'returns paginated import records data' do
        get "/api/v1/imports/imports/#{import.id}/import_records", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['data']).to be_present
        expect(json_response['data']['importRecords']).to be_an(Array)
      end
    end

    context 'when the import does not exist' do
      it 'returns not found status' do
        get "/api/v1/imports/imports/999999/import_records", headers: headers

        expect(response).to have_http_status(:not_found)
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['message']).to eq('Resource not found')
        expect(json_response['error']['details']).to eq('Import not found')
      end
    end

    context 'when the import belongs to a different space' do
      let!(:other_space) { create(:personal_space) }
      let!(:other_import) do
        Imports::Import.create!(
          user: user,
          space: other_space,
          import_location: 'settings',
          status: 'completed'
        )
      end

      it 'returns not found status' do
        get "/api/v1/imports/imports/#{other_import.id}/import_records", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'when the ListImportRecords query fails' do
      before do
        allow(Imports::Queries::ListImportRecords).to receive(:new).and_return(mock_query)
        allow(mock_query).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new('Query failed')
        )
      end

      it 'returns internal server error' do
        get "/api/v1/imports/imports/#{import.id}/import_records", headers: headers

        expect(response).to have_http_status(:internal_server_error)
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['details']).to eq('Query failed')
      end
    end

    context 'when the request is unauthenticated' do
      it 'returns unauthorized status' do
        get "/api/v1/imports/imports/#{import.id}/import_records",
            headers: { 'Accept' => 'application/json' }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'GET /api/v1/imports/imports/:import_id/import_records/:id' do
    context 'when the request is successful' do
      before do
        allow(Imports::Serializers::ImportRecordSerializer).to receive(:render_as_hash).and_return(
          {
            id: import_record.id.to_s,
            rowNumber: 1,
            status: 'failed',
            originalData: import_record.original_data
          }
        )
      end

      it 'returns an HTTP status_ok' do
        get "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}", headers: headers

        expect(response).to have_http_status(:ok)
      end

      it 'returns the import record data' do
        get "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['data']).to be_present
        expect(json_response['data']['importRecord']).to be_present
      end

      it 'uses ImportRecordSerializer' do
        get "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}", headers: headers

        expect(Imports::Serializers::ImportRecordSerializer).to have_received(:render_as_hash).with(import_record)
      end
    end

    context 'when the import does not exist' do
      it 'returns not found status' do
        get "/api/v1/imports/imports/999999/import_records/#{import_record.id}", headers: headers

        expect(response).to have_http_status(:not_found)
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['details']).to eq('Import not found')
      end
    end

    context 'when the import record does not exist' do
      it 'returns not found status' do
        get "/api/v1/imports/imports/#{import.id}/import_records/999999", headers: headers

        expect(response).to have_http_status(:not_found)
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['details']).to eq('Import record not found')
      end
    end

    context 'when the import belongs to a different space' do
      let!(:other_space) { create(:personal_space) }
      let!(:other_import) do
        Imports::Import.create!(
          user: user,
          space: other_space,
          import_location: 'settings',
          status: 'completed'
        )
      end

      it 'returns not found status' do
        get "/api/v1/imports/imports/#{other_import.id}/import_records/#{import_record.id}", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'when the request is unauthenticated' do
      it 'returns unauthorized status' do
        get "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}",
            headers: { 'Accept' => 'application/json' }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'PUT /api/v1/imports/imports/:import_id/import_records/:id' do
    let(:mock_update_operation) { instance_double(Imports::Operations::UpdateImportRecord) }
    let(:valid_update_params) do
      {
        date: '2024-01-20',
        description: 'Updated transaction',
        amount: 150.00,
        type: 'expense',
        category: 'Groceries'
      }
    end

    context 'when the request is successful' do
      let(:updated_import_record) do
        import_record.tap do |record|
          record.edited_data = valid_update_params
          record.status = 'edited'
        end
      end

      before do
        allow(Imports::Operations::UpdateImportRecord).to receive(:new).and_return(mock_update_operation)
        allow(mock_update_operation).to receive(:call).and_return(
          Dry::Monads::Result::Success.new(updated_import_record)
        )
        allow(Imports::Serializers::ImportRecordSerializer).to receive(:render_as_hash).and_return(
          {
            id: updated_import_record.id.to_s,
            rowNumber: 1,
            status: 'edited',
            editedData: valid_update_params
          }
        )
      end

      it 'returns an HTTP status_ok' do
        put "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}",
            params: valid_update_params,
            headers: headers

        expect(response).to have_http_status(:ok)
      end

      it 'calls UpdateImportRecord operation with correct parameters' do
        put "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}",
            params: valid_update_params,
            headers: headers

        expect(mock_update_operation).to have_received(:call) do |params|
          expect(params[:import_record_id]).to eq(import_record.id.to_s)
          expect(params[:date]).to eq('2024-01-20')
          expect(params[:description]).to eq('Updated transaction')
          expect(params[:amount]).to eq('150.0')
          expect(params[:type]).to eq('expense')
          expect(params[:category]).to eq('Groceries')
        end
      end

      it 'returns the updated import record data' do
        put "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}",
            params: valid_update_params,
            headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['data']).to be_present
        expect(json_response['data']['importRecord']).to be_present
      end
    end

    context 'when the UpdateImportRecord operation fails' do
      let(:failure_details) { { error: 'Import record is not editable' } }

      before do
        allow(Imports::Operations::UpdateImportRecord).to receive(:new).and_return(mock_update_operation)
        allow(mock_update_operation).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new(failure_details)
        )
      end

      it 'returns unprocessable content status' do
        put "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}",
            params: valid_update_params,
            headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['details']).to eq(failure_details.deep_stringify_keys)
      end
    end

    context 'when the import does not exist' do
      it 'returns not found status' do
        put "/api/v1/imports/imports/999999/import_records/#{import_record.id}",
            params: valid_update_params,
            headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'when the import record does not exist' do
      it 'returns not found status' do
        put "/api/v1/imports/imports/#{import.id}/import_records/999999",
            params: valid_update_params,
            headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'when the request is unauthenticated' do
      it 'returns unauthorized status' do
        put "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}",
            params: valid_update_params,
            headers: { 'Accept' => 'application/json' }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe 'POST /api/v1/imports/imports/:import_id/import_records/:id/import' do
    let(:mock_import_operation) { instance_double(Imports::Operations::ImportSingleRecord) }
    let!(:transaction) { create(:expense_transaction, user: user, space: space) }

    context 'when the request is successful' do
      before do
        allow(Imports::Operations::ImportSingleRecord).to receive(:new).and_return(mock_import_operation)
        allow(mock_import_operation).to receive(:call).and_return(
          Dry::Monads::Result::Success.new(transaction)
        )
        allow(Imports::Serializers::ImportRecordSerializer).to receive(:render_as_hash).and_return(
          {
            id: import_record.id.to_s,
            rowNumber: 1,
            status: 'success'
          }
        )
        allow(Transactions::Serializers::TransactionSerializer).to receive(:render_as_hash).and_return(
          {
            id: transaction.id.to_s,
            amount: transaction.amount.to_s,
            description: transaction.description
          }
        )
      end

      it 'returns an HTTP status_ok' do
        post "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}/import", headers: headers

        expect(response).to have_http_status(:ok)
      end

      it 'calls ImportSingleRecord operation with correct parameters' do
        post "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}/import", headers: headers

        expect(mock_import_operation).to have_received(:call).with(
          hash_including(import_record: import_record)
        )
      end

      it 'returns the transaction and updated import record data' do
        post "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}/import", headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(true)
        expect(json_response['message']).to eq('Record imported successfully')
        expect(json_response['data']).to be_present
        expect(json_response['data']['transaction']).to be_present
        expect(json_response['data']['importRecord']).to be_present
      end
    end

    context 'when the ImportSingleRecord operation fails' do
      let(:failure_details) { { error: 'Import record is not editable' } }

      before do
        allow(Imports::Operations::ImportSingleRecord).to receive(:new).and_return(mock_import_operation)
        allow(mock_import_operation).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new(failure_details)
        )
      end

      it 'returns unprocessable content status' do
        post "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}/import", headers: headers

        expect(response).to have_http_status(:unprocessable_content)
        json_response = JSON.parse(response.body)
        expect(json_response['success']).to be(false)
        expect(json_response['error']['details']).to eq(failure_details.deep_stringify_keys)
      end
    end

    context 'when the import does not exist' do
      it 'returns not found status' do
        post "/api/v1/imports/imports/999999/import_records/#{import_record.id}/import", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'when the import record does not exist' do
      it 'returns not found status' do
        post "/api/v1/imports/imports/#{import.id}/import_records/999999/import", headers: headers

        expect(response).to have_http_status(:not_found)
      end
    end

    context 'when the request is unauthenticated' do
      it 'returns unauthorized status' do
        post "/api/v1/imports/imports/#{import.id}/import_records/#{import_record.id}/import",
            headers: { 'Accept' => 'application/json' }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
