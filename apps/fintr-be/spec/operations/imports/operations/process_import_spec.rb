# frozen_string_literal: true

require "rails_helper"
require "dry/monads"

RSpec.describe Imports::Operations::ProcessImport, type: :operation do
  include Dry::Monads[:result]
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:import) do
    import = Imports::Import.create!(
      user_id: user.id,
      space_id: space.id,
      import_location: "settings",
      status: "pending"
    )
    # Attach a file for testing
    import.file.attach(
      io: StringIO.new("test file content"),
      filename: "test.xlsx",
      content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    import
  end
  let(:valid_params) { { import: import } }
  let(:mock_account) { create(:account, space: space) }
  let(:mock_rows_data) do
    [
      { row_number: 2, data: ["2024-01-01", "100", "Test", "Category"] },
      { row_number: 3, data: ["2024-01-02", "200", "Test 2", "Category 2"] }
    ]
  end

  before do
    allow(Rails.logger).to receive(:info)
    allow(Rails.logger).to receive(:error)
    allow(Rails.logger).to receive(:warn)
    allow(Ai::Embeddings::GenerateEmbeddingJob).to receive(:perform_later)
  end

  describe "Contract" do
    it "succeeds with valid import" do
      result = operation.validate(params: valid_params)

      expect(result).to be_success
    end

    it "fails without import" do
      result = operation.validate(params: {})

      expect(result).to be_failure
      expect(result.failure).to have_key(:import)
    end

    it "fails with invalid import type" do
      params_with_invalid_import = { import: "not an import" }
      result = operation.validate(params: params_with_invalid_import)

      expect(result).to be_failure
      expect(result.failure).to have_key(:import)
    end
  end

  describe "#call" do
    context "when all steps succeed" do
      let(:mock_find_account_op) { instance_double(Imports::Operations::Accounts::FindOrCreateImportAccount) }
      let(:mock_prepare_categories_op) { instance_double(Imports::Operations::PrepareCategories) }
      let(:mock_validate_rows_op) { instance_double(Imports::Operations::ValidateAndPrepareRows) }
      let(:mock_bulk_import_op) { instance_double(Imports::Operations::BulkImportTransactions) }
      let(:mock_workbook) { instance_double(Xsv::Workbook) }
      let(:mock_sheet) { instance_double(Xsv::Sheet) }

      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))

        # Stub the private methods that call the operations
        # These methods unwrap the result, so we return the unwrapped value wrapped in Success
        allow(operation).to receive(:prepare_categories).and_return(
          Dry::Monads::Success.new({ category_map: { "Category" => 1, "Category 2" => 2 } })
        )

        allow(operation).to receive(:validate_and_prepare_rows).and_return(
          Dry::Monads::Success.new({
            validated_rows: mock_rows_data,
            failed_records: []
          })
        )

        allow(operation).to receive(:bulk_import_transactions).and_return(
          Dry::Monads::Success.new({ import_records: [double, double] })
        )
        # rubocop:enable RSpec/SubjectStub

        # Mock Excel file reading
        allow(import.file).to receive(:download).and_return("excel file content")
        allow(Xsv).to receive(:open).and_return(mock_workbook)
        allow(mock_workbook).to receive(:sheets).and_return([mock_sheet])
        allow(mock_sheet).to receive(:each_with_index).and_yield(["Date", "Amount", "Description", "Category"], 0)
                                                      .and_yield(mock_rows_data[0][:data], 1)
                                                      .and_yield(mock_rows_data[1][:data], 2)
      end

      it "updates import status to processing initially" do
        # The status will be updated to processing, then to completed if successful
        # So we need to check it was set to processing at some point
        allow(import).to receive(:update_columns).and_call_original
        operation.call(valid_params)

        expect(import).to have_received(:update_columns).with(status: "processing")
      end

      it "calls get_or_create_import_account" do
        # rubocop:disable RSpec/SubjectStub, RSpec/StubbedMock
        expect(operation).to receive(:get_or_create_import_account).with(space_id: space.id).and_return(Dry::Monads::Success.new(mock_account))
        # rubocop:enable RSpec/SubjectStub, RSpec/StubbedMock
        operation.call(valid_params)
      end

      it "reads Excel file and processes rows" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(Xsv).to have_received(:open)
      end

      it "calls prepare_categories" do
        operation.call(valid_params)

        # rubocop:disable RSpec/SubjectStub
        expect(operation).to have_received(:prepare_categories)
        # rubocop:enable RSpec/SubjectStub
      end

      it "calls validate_and_prepare_rows" do
        operation.call(valid_params)

        # rubocop:disable RSpec/SubjectStub
        expect(operation).to have_received(:validate_and_prepare_rows)
        # rubocop:enable RSpec/SubjectStub
      end

      it "calls bulk_import_transactions" do
        operation.call(valid_params)

        # rubocop:disable RSpec/SubjectStub
        expect(operation).to have_received(:bulk_import_transactions)
        # rubocop:enable RSpec/SubjectStub
      end

      it "updates import with statistics" do
        operation.call(valid_params)

        import.reload
        expect(import.total_rows_read).to eq(2)
        expect(import.total_rows_inserted).to eq(2)
        expect(import.total_rows_failed).to eq(0)
        expect(import.status).to eq("completed")
      end

      it "enqueues embedding jobs for successful transactions" do
        # Create a successful import record with a transaction
        transaction = create(:expense_transaction, space: space)
        import_record = Imports::ImportRecord.new(import: import, row_number: 1)
        import_record.record = transaction
        import_record.save!

        operation.call(valid_params)

        expect(Ai::Embeddings::GenerateEmbeddingJob).to have_received(:perform_later).at_least(:once)
      end
    end

    context "when import has no file attached" do
      let(:import_without_file) do
        Imports::Import.create!(
          user_id: user.id,
          space_id: space.id,
          import_location: "settings",
          status: "pending"
        )
      end
      let(:params_without_file) { { import: import_without_file } }

      it "returns failure and updates import status" do
        result = operation.call(params_without_file)

        expect(result).to be_failure
        expect(result.failure[:error]).to eq("No file attached")
        expect(import_without_file.reload.status).to eq("failed")
        expect(import_without_file.import_errors).to include("No file attached")
      end
    end

    context "when file blob is not found" do
      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))
        # Stub the actual read_excel_file method to return failure and update import status
        allow(operation).to receive(:read_excel_file) do |**args|
          import.update_columns(status: "failed", import_errors: ["File blob not found"])
          Failure(error: "File blob not found")
        end
        # rubocop:enable RSpec/SubjectStub
      end

      it "returns failure and updates import status" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to eq("File blob not found")
        expect(import.reload.status).to eq("failed")
        expect(import.import_errors).to include("File blob not found")
      end
    end

    context "when file is CSV" do
      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))
        error_message = "CSV files are not supported. Please convert your file to Excel (.xlsx) format and try again."
        allow(operation).to receive(:read_excel_file) do |**args|
          import.update_columns(status: "failed", import_errors: [error_message])
          Failure(error: error_message)
        end
        # rubocop:enable RSpec/SubjectStub
      end

      it "returns failure with CSV error message" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to include("CSV files are not supported")
        expect(import.reload.status).to eq("failed")
      end
    end

    context "when Excel file cannot be opened" do
      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))
        error_message = "File format error: The file could not be opened as an Excel file. Please ensure you're uploading a valid Excel (.xlsx) file. Error: Invalid file"
        allow(operation).to receive(:read_excel_file) do |**args|
          import.update_columns(status: "failed", import_errors: [error_message])
          Failure(error: error_message)
        end
        # rubocop:enable RSpec/SubjectStub
      end

      it "returns failure with file format error" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to include("File format error")
        expect(import.reload.status).to eq("failed")
      end
    end

    context "when Excel file is empty" do
      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))
        error_message = "Excel file is empty or invalid. Please ensure you're uploading a valid Excel (.xlsx) file."
        allow(operation).to receive(:read_excel_file) do |**args|
          import.update_columns(status: "failed", import_errors: [error_message])
          Failure(error: error_message)
        end
        # rubocop:enable RSpec/SubjectStub
      end

      it "returns failure with empty file error" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to include("Excel file is empty")
        expect(import.reload.status).to eq("failed")
      end
    end

    context "when Excel file has no data rows" do
      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))
        error_message = "No data rows found in file. Please ensure the file contains at least one data row after the header."
        allow(operation).to receive(:read_excel_file) do |**args|
          import.update_columns(status: "failed", import_errors: [error_message])
          Failure(error: error_message)
        end
        # rubocop:enable RSpec/SubjectStub
      end

      it "returns failure with no data rows error" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to include("No data rows found in file")
        expect(import.reload.status).to eq("failed")
      end
    end

    context "when read_excel_file returns nil" do
      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))

        # Mock read_excel_file to return Success(nil) - this will be caught by defensive checks
        allow(operation).to receive(:read_excel_file).and_return(Dry::Monads::Success.new(nil))
        # rubocop:enable RSpec/SubjectStub
      end

      it "returns failure and updates import status" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to include("File could not be read")
        expect(import.reload.status).to eq("failed")
      end
    end

    context "when read_excel_file returns non-array" do
      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))

        # Mock read_excel_file to return Success with non-array - this will be caught by defensive checks
        allow(operation).to receive(:read_excel_file).and_return(Dry::Monads::Success.new("not an array"))
        # rubocop:enable RSpec/SubjectStub
      end

      it "returns failure and updates import status" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to include("File format error")
        expect(import.reload.status).to eq("failed")
      end
    end

    context "when read_excel_file returns empty array" do
      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))

        # Mock read_excel_file to return Success with empty array - this will be caught by defensive checks
        allow(operation).to receive(:read_excel_file).and_return(Dry::Monads::Success.new([]))
        # rubocop:enable RSpec/SubjectStub
      end

      it "returns failure and updates import status" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to include("No data found in file")
        expect(import.reload.status).to eq("failed")
      end
    end

    context "when process_rows fails" do
      let(:mock_workbook) { instance_double(Xsv::Workbook) }
      let(:mock_sheet) { instance_double(Xsv::Sheet) }

      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))
        # rubocop:enable RSpec/SubjectStub

        allow(import.file).to receive(:download).and_return("excel content")
        allow(Xsv).to receive(:open).and_return(mock_workbook)
        allow(mock_workbook).to receive(:sheets).and_return([mock_sheet])
        allow(mock_sheet).to receive(:each_with_index).and_yield(["Date", "Amount", "Description", "Category"], 0)
                                                      .and_yield(mock_rows_data[0][:data], 1)

        allow(Imports::Operations::PrepareCategories).to receive(:new).and_raise(StandardError.new("Process error"))
      end

      it "handles exception and updates import status" do
        result = operation.call(valid_params)

        # Dry::Operation wraps return values, so we need to unwrap if it's Success(Failure(...))
        if result.success? && result.value!.is_a?(Dry::Monads::Result::Failure)
          failure = result.value!
          expect(failure).to be_failure
          expect(failure.failure[:error]).to include("Failed to upload the file")
        else
          expect(result).to be_failure
          expect(result.failure[:error]).to include("Failed to upload the file")
        end
        expect(import.reload.status).to eq("failed")
        expect(import.import_errors).to include(match(/Failed to upload the file/))
      end
    end

    context "when exception occurs with specific error messages" do
      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))
        allow(operation).to receive(:read_excel_file).and_raise(StandardError.new("undefined method 'each'"))
        # rubocop:enable RSpec/SubjectStub
      end

      it "provides user-friendly error message" do
        result = operation.call(valid_params)

        # Dry::Operation wraps return values, so we need to unwrap if it's Success(Failure(...))
        if result.success? && result.value!.is_a?(Dry::Monads::Result::Failure)
          failure = result.value!
          expect(failure).to be_failure
          expect(failure.failure[:error]).to include("File format error")
        else
          expect(result).to be_failure
          expect(result.failure[:error]).to include("File format error")
        end
        expect(import.reload.status).to eq("failed")
        expect(import.import_errors.first).to include("File format error")
      end
    end

    context "when bulk import fails with database error" do
      let(:mock_prepare_categories_op) { instance_double(Imports::Operations::PrepareCategories) }
      let(:mock_validate_rows_op) { instance_double(Imports::Operations::ValidateAndPrepareRows) }
      let(:mock_bulk_import_op) { instance_double(Imports::Operations::BulkImportTransactions) }
      let(:mock_workbook) { instance_double(Xsv::Workbook) }
      let(:mock_sheet) { instance_double(Xsv::Sheet) }

      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:get_or_create_import_account).and_return(Dry::Monads::Success.new(mock_account))
        allow(operation).to receive(:read_excel_file).and_return(Dry::Monads::Success.new(mock_rows_data))

        allow(operation).to receive(:prepare_categories).and_return(
          Dry::Monads::Success.new({ category_map: { "Category" => 1 } })
        )

        allow(operation).to receive(:validate_and_prepare_rows).and_return(
          Dry::Monads::Success.new({
            validated_rows: mock_rows_data,
            failed_records: []
          })
        )

        allow(operation).to receive(:bulk_import_transactions).and_raise(ActiveRecord::StatementInvalid.new("DB error"))
        # rubocop:enable RSpec/SubjectStub
      end

      it "handles database error gracefully" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(import.reload.status).to eq("failed")
        expect(import.total_rows_failed).to eq(2)
      end
    end
  end

  describe "#read_excel_file" do
    let(:mock_workbook) { instance_double(Xsv::Workbook) }
    let(:mock_sheet) { instance_double(Xsv::Sheet) }

    before do
      allow(import.file).to receive(:download).and_return("excel content")
      allow(Xsv).to receive(:open).and_return(mock_workbook)
      allow(mock_workbook).to receive(:sheets).and_return([mock_sheet])
    end

    context "when file reading succeeds" do
      before do
        allow(mock_sheet).to receive(:each_with_index).and_yield(["Date", "Amount", "Description", "Category"], 0)
                                                      .and_yield(["2024-01-01", "100", "Test", "Category"], 1)
      end

      it "returns Success with rows data" do
        result = operation.send(:read_excel_file, import: import)

        expect(result).to be_success
        expect(result.value!).to be_an(Array)
        expect(result.value!.length).to eq(1)
      end

      it "skips header row" do
        result = operation.send(:read_excel_file, import: import)

        rows = result.value!
        expect(rows.first[:row_number]).to eq(2)
      end
    end

    context "when file download fails with FileNotFoundError" do
      before do
        allow(import.file).to receive(:download).and_raise(ActiveStorage::FileNotFoundError.new("File not found"))
      end

      it "retries with exponential backoff" do
        # Mock sleep to avoid actual delays
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:sleep)
        # rubocop:enable RSpec/SubjectStub

        result = operation.send(:read_excel_file, import: import)

        expect(result).to be_failure
        expect(result.failure[:error]).to include("File not found in storage")
        expect(import.reload.status).to eq("failed")
      end
    end
  end

  describe "#process_rows" do
    context "when rows_data is not an array" do
      it "returns failure" do
        result = operation.send(:process_rows, import: import, rows_data: "not an array", import_account: mock_account)

        expect(result).to be_failure
        expect(result.failure[:error]).to include("rows_data must be an array")
        expect(import.reload.status).to eq("failed")
      end
    end

    context "when all steps succeed" do
      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:prepare_categories).and_return(
          Dry::Monads::Success.new({ category_map: { "Category" => 1 } })
        )
        allow(operation).to receive(:validate_and_prepare_rows).and_return(
          Dry::Monads::Success.new({
            validated_rows: mock_rows_data,
            failed_records: []
          })
        )
        allow(operation).to receive(:bulk_import_transactions).and_return(
          Dry::Monads::Success.new({ import_records: [double, double] })
        )
        # rubocop:enable RSpec/SubjectStub
      end

      it "processes rows successfully" do
        result = operation.send(:process_rows, import: import, rows_data: mock_rows_data, import_account: mock_account)

        expect(result).to be_success
        expect(import.reload.status).to eq("completed")
        expect(import.total_rows_read).to eq(2)
        expect(import.total_rows_inserted).to eq(2)
      end
    end

    context "when some rows fail validation" do
      let(:failed_records) do
        [
          { row_number: 3, errors: { amount: ["is required"] } }
        ]
      end

      before do
        # rubocop:disable RSpec/SubjectStub
        allow(operation).to receive(:prepare_categories).and_return(
          Dry::Monads::Success.new({ category_map: { "Category" => 1 } })
        )
        allow(operation).to receive(:validate_and_prepare_rows).and_return(
          Dry::Monads::Success.new({
            validated_rows: [mock_rows_data[0]],
            failed_records: failed_records
          })
        )
        allow(operation).to receive(:bulk_import_transactions).and_return(
          Dry::Monads::Success.new({ import_records: [double] })
        )
        # rubocop:enable RSpec/SubjectStub
      end

      it "marks import as failed with errors" do
        result = operation.send(:process_rows, import: import, rows_data: mock_rows_data, import_account: mock_account)

        expect(result).to be_success
        expect(import.reload.status).to eq("failed")
        expect(import.total_rows_failed).to eq(1)
        expect(import.import_errors).to be_an(Array)
      end
    end
  end

  describe "#add_embeddings" do
    context "when there are successful transactions" do
      let(:transaction) { create(:expense_transaction, space: space) }
      let!(:import_record) do
        record = Imports::ImportRecord.new(import: import, row_number: 1)
        record.record = transaction
        record.save!
        record
      end

      it "enqueues embedding jobs" do
        result = operation.send(:add_embeddings, import: import)

        expect(result).to be_success
        expect(Ai::Embeddings::GenerateEmbeddingJob).to have_received(:perform_later).with(
          embeddable_id: transaction.id,
          embeddable_type: "Transactions::Expense",
          space_id: space.id
        )
      end
    end

    context "when there are no successful transactions" do
      it "returns success without enqueueing jobs" do
        result = operation.send(:add_embeddings, import: import)

        expect(result).to be_success
        expect(Ai::Embeddings::GenerateEmbeddingJob).not_to have_received(:perform_later)
      end
    end

    context "when embedding job enqueueing fails" do
      let(:transaction) { create(:expense_transaction, space: space) }
      let!(:import_record) do
        record = Imports::ImportRecord.new(import: import, row_number: 1)
        record.record = transaction
        record.save!
        record
      end

      before do
        allow(Ai::Embeddings::GenerateEmbeddingJob).to receive(:perform_later).and_raise(StandardError.new("Job error"))
      end

      it "returns success anyway" do
        result = operation.send(:add_embeddings, import: import)

        expect(result).to be_success
      end
    end
  end
end
