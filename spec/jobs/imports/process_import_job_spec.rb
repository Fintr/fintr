# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::ProcessImportJob, type: :job do
  subject(:job) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:import) do
    Imports::Import.create!(
      user: user,
      space: space,
      import_location: "settings",
      status: "pending"
    )
  end
  let(:import_id) { import.id }
  let(:mock_operation) { instance_spy(Imports::Operations::ProcessImport) }

  before do
    allow(Rails.logger).to receive(:error)
    allow(Sentry).to receive(:capture_exception)
    allow(Imports::Operations::ProcessImport).to receive(:new).and_return(mock_operation)
  end

  describe "#perform" do
    context "when import exists" do
      context "when operation succeeds" do
        let(:success_result) { Dry::Monads::Success.new(import) }

        before do
          allow(mock_operation).to receive(:call).and_return(success_result)
        end

        it "calls ProcessImport operation with the import" do
          job.perform(import_id)

          expect(mock_operation).to have_received(:call).with(import: import)
        end

        it "does not update import status" do
          expect { job.perform(import_id) }.not_to change { import.reload.status }
        end

        it "does not log errors" do
          job.perform(import_id)

          expect(Rails.logger).not_to have_received(:error)
        end
      end

      context "when operation fails" do
        let(:failure_result) { Dry::Monads::Failure.new(error: "Test error message") }

        before do
          allow(mock_operation).to receive(:call).and_return(failure_result)
        end

        it "calls ProcessImport operation with the import" do
          job.perform(import_id)

          expect(mock_operation).to have_received(:call).with(import: import)
        end

        it "updates import status to failed" do
          job.perform(import_id)

          expect(import.reload.status).to eq("failed")
        end

        it "sets import_errors with extracted error message" do
          job.perform(import_id)

          expect(import.reload.import_errors).to include("Failed to process import: Test error message")
        end

        it "logs the error" do
          job.perform(import_id)

          expect(Rails.logger).to have_received(:error).with("Import #{import_id} failed: #{failure_result.failure}")
        end

        context "when failure contains error key with upload-related message" do
          let(:failure_result) { Dry::Monads::Failure.new(error: "Failed to upload the file: File not found") }

          it "uses the error message as-is" do
            job.perform(import_id)

            expect(import.reload.import_errors).to include("Failed to upload the file: File not found")
          end
        end

        context "when failure contains error key with No file attached message" do
          let(:failure_result) { Dry::Monads::Failure.new(error: "No file attached") }

          it "uses the error message as-is" do
            job.perform(import_id)

            expect(import.reload.import_errors).to include("No file attached")
          end
        end

        context "when failure contains errors hash" do
          let(:failure_result) { Dry::Monads::Failure.new(errors: { field: ["is required"] }) }

          it "extracts the first error from the hash" do
            job.perform(import_id)

            expect(import.reload.import_errors).to include("is required")
          end
        end

        context "when failure contains errors array" do
          let(:failure_result) { Dry::Monads::Failure.new(errors: ["First error", "Second error"]) }

          it "extracts the first error from the array" do
            job.perform(import_id)

            expect(import.reload.import_errors).to include("First error")
          end
        end

        context "when failure is a string" do
          let(:failure_result) { Dry::Monads::Failure.new("Simple error message") }

          it "uses the string as the error message" do
            job.perform(import_id)

            expect(import.reload.import_errors).to include("Simple error message")
          end
        end
      end

      context "when operation raises StandardError" do
        let(:error_message) { "Unexpected error occurred" }
        let(:error) { StandardError.new(error_message) }

        before do
          allow(mock_operation).to receive(:call).and_raise(error)
        end

        it "updates import status to failed" do
          job.perform(import_id)

          expect(import.reload.status).to eq("failed")
        end

        it "sets import_errors with formatted error message" do
          job.perform(import_id)

          expect(import.reload.import_errors).to include("Failed to upload the file: #{error_message}")
        end

        it "logs the error with backtrace" do
          job.perform(import_id)

          expect(Rails.logger).to have_received(:error).with(
            include("Import #{import_id} job error: #{error_message}")
          )
        end

        it "sends exception to Sentry" do
          job.perform(import_id)

          expect(Sentry).to have_received(:capture_exception).with(error)
        end
      end
    end

    context "when import does not exist" do
      let(:import_id) { 999_999 }

      it "returns early without calling the operation" do
        job.perform(import_id)

        expect(mock_operation).not_to have_received(:call)
      end

      it "does not raise an error" do
        expect { job.perform(import_id) }.not_to raise_error
      end

      it "does not log errors" do
        job.perform(import_id)

        expect(Rails.logger).not_to have_received(:error)
      end
    end
  end

  describe "#extract_error_message" do
    context "when failure is a hash with error key" do
      it "returns formatted error message for generic errors" do
        failure = { error: "Something went wrong" }
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Failed to process import: Something went wrong")
      end

      it "returns error as-is for upload-related errors" do
        failure = { error: "Failed to upload the file: File not found" }
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Failed to upload the file: File not found")
      end

      it "returns error as-is for No file attached errors" do
        failure = { error: "No file attached" }
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("No file attached")
      end

      it "returns error as-is for Failed to read Excel file errors" do
        failure = { error: "Failed to read Excel file: Invalid format" }
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Failed to read Excel file: Invalid format")
      end

      it "returns error as-is for Excel file is empty errors" do
        failure = { error: "Excel file is empty" }
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Excel file is empty")
      end
    end

    context "when failure is a hash with errors key" do
      it "extracts first error from hash of errors" do
        failure = { errors: { field1: ["Error 1"], field2: ["Error 2"] } }
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Error 1")
      end

      it "extracts first error from array of errors" do
        failure = { errors: ["First error", "Second error"] }
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("First error")
      end

      it "returns default message when errors hash is empty" do
        failure = { errors: {} }
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Failed to process import")
      end

      it "returns default message when errors array is empty" do
        failure = { errors: [] }
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Failed to process import")
      end
    end

    context "when failure is a hash without error or errors keys" do
      it "returns default message" do
        failure = { other_key: "value" }
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Failed to process import")
      end
    end

    context "when failure is a string" do
      it "returns the string as-is when present" do
        failure = "Simple error message"
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Simple error message")
      end

      it "returns default message when string is empty" do
        failure = ""
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Failed to process import")
      end
    end

    context "when failure is not a hash or string" do
      it "converts to string and returns it" do
        failure = 123
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("123")
      end

      it "returns default message when converted string is empty" do
        failure = nil
        result = job.send(:extract_error_message, failure)

        expect(result).to eq("Failed to process import")
      end
    end
  end
end
