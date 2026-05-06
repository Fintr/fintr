# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Operations::ValidateAndPrepareRows, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:import) { create(:import, user: user, space: space) }
  let(:income_category) { create(:category, space: space, category_type: "income", name: "Salary") }
  let(:expense_category) { create(:category, space: space, category_type: "expense", name: "Food") }
  let(:category_map) do
    {
      "income:Salary" => income_category,
      "expense:Food" => expense_category
    }
  end
  let(:import_account) { create(:account, space: space) }

  before do
    allow(Rails.logger).to receive(:error)
  end

  describe "#call" do
    context "when rows_data is not an array" do
      let(:invalid_params) do
        {
          import: import,
          rows_data: "not an array",
          category_map: category_map,
          import_account: import_account
        }
      end

      it "returns failure with error message" do
        result = operation.call(invalid_params)

        # Dry::Operation wraps Failure in Success
        expect(result).to be_success
        value = result.value!
        expect(value).to be_a(Dry::Monads::Result::Failure)
        failure = value.failure
        expect(failure).to have_key(:error)
        expect(failure[:error]).to eq("Invalid file data: rows_data must be an array")
      end
    end

    context "when rows_data is an empty array" do
      let(:valid_params) do
        {
          import: import,
          rows_data: [],
          category_map: category_map,
          import_account: import_account
        }
      end

      it "returns success with empty arrays" do
        result = operation.call(valid_params)

        expect(result).to be_success
        value = result.value!
        # Handle potential double-wrapping
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        expect(value[:validated_rows]).to eq([])
        expect(value[:failed_records]).to eq([])
      end
    end

    context "when all rows are valid" do
      let(:rows_data) do
        [
          {
            row_number: 1,
            data: ["2024-01-01", "Salary payment", "50000", "income", "Salary"]
          },
          {
            row_number: 2,
            data: ["2024-01-02", "Grocery shopping", "2500", "expense", "Food"]
          }
        ]
      end

      let(:valid_params) do
        {
          import: import,
          rows_data: rows_data,
          category_map: category_map,
          import_account: import_account
        }
      end

      it "returns success with validated rows" do
        result = operation.call(valid_params)

        expect(result).to be_success
        value = result.value!
        # Handle potential double-wrapping
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        expect(value[:validated_rows].length).to eq(2)
        expect(value[:failed_records]).to eq([])
      end

      it "includes correct row data in validated rows" do
        result = operation.call(valid_params)

        value = result.value!
        # Handle potential double-wrapping
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        validated_rows = value[:validated_rows]
        expect(validated_rows[0][:row_number]).to eq(1)
        expect(validated_rows[0][:row_data][:date]).to eq("2024-01-01")
        expect(validated_rows[0][:row_data][:description]).to eq("Salary payment")
        expect(validated_rows[0][:row_data][:amount]).to eq(50000)
        expect(validated_rows[0][:row_data][:type]).to eq("income")
        expect(validated_rows[0][:category]).to eq(income_category)
        expect(validated_rows[0][:parsed_date]).to eq(Date.parse("2024-01-01"))
      end

      it "does not create failed import records" do
        expect { operation.call(valid_params) }.not_to change(Imports::ImportRecord, :count)
      end
    end

    context "when some rows are invalid" do
      let(:rows_data) do
        [
          {
            row_number: 1,
            data: ["2024-01-01", "Salary payment", "50000", "income", "Salary"]
          },
          {
            row_number: 2,
            data: ["invalid-date", "Grocery shopping", "2500", "expense", "Food"]
          },
          {
            row_number: 3,
            data: ["2024-01-03", "Another expense", "0", "expense", "Food"]
          }
        ]
      end

      let(:valid_params) do
        {
          import: import,
          rows_data: rows_data,
          category_map: category_map,
          import_account: import_account
        }
      end

      it "returns success with validated and failed records" do
        result = operation.call(valid_params)

        expect(result).to be_success
        value = result.value!
        # Handle potential double-wrapping
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        expect(value[:validated_rows].length).to eq(1)
        expect(value[:failed_records].length).to eq(2)
      end

      it "creates failed import records" do
        expect { operation.call(valid_params) }.to change(Imports::ImportRecord, :count).by(2)
      end

      it "includes error information in failed records" do
        result = operation.call(valid_params)

        value = result.value!
        # Handle potential double-wrapping
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        failed_records = value[:failed_records]
        expect(failed_records[0][:row_number]).to eq(2)
        expect(failed_records[0][:errors]).to be_an(Array)
        expect(failed_records[0][:errors].any? { |e| e.include?("Date") }).to be true
      end
    end

    context "when all rows are invalid" do
      let(:rows_data) do
        [
          {
            row_number: 1,
            data: ["invalid-date", "Test", "0", "invalid", "Unknown"]
          },
          {
            row_number: 2,
            data: ["2024-01-01", "Test", "-100", "expense", "Unknown"]
          }
        ]
      end

      let(:valid_params) do
        {
          import: import,
          rows_data: rows_data,
          category_map: category_map,
          import_account: import_account
        }
      end

      it "returns success with all failed records" do
        result = operation.call(valid_params)

        expect(result).to be_success
        value = result.value!
        # Handle potential double-wrapping
        value = value.value! if value.is_a?(Dry::Monads::Result::Success)
        expect(value[:validated_rows]).to eq([])
        expect(value[:failed_records].length).to eq(2)
      end

      it "creates failed import records for all rows" do
        expect { operation.call(valid_params) }.to change(Imports::ImportRecord, :count).by(2)
      end
    end
  end

  describe "private methods" do
    describe "#parse_row_data" do
      it "parses row data correctly" do
        row = ["2024-01-01", "Test description", "100", "income", "Salary"]
        result = operation.send(:parse_row_data, row)

        expect(result[:date]).to eq("2024-01-01")
        expect(result[:description]).to eq("Test description")
        expect(result[:amount]).to eq(100)
        expect(result[:type]).to eq("income")
        expect(result[:category]).to eq("Salary")
      end

      it "handles nil values" do
        row = [nil, nil, nil, nil, nil]
        result = operation.send(:parse_row_data, row)

        expect(result[:date]).to be_nil
        expect(result[:description]).to be_nil
        expect(result[:amount]).to be_nil
        expect(result[:type]).to be_nil
        expect(result[:category]).to be_nil
      end

      it "strips whitespace from string values" do
        row = ["  2024-01-01  ", "  Test  ", "100", "  income  ", "  Salary  "]
        result = operation.send(:parse_row_data, row)

        expect(result[:date]).to eq("2024-01-01")
        expect(result[:description]).to eq("Test")
        expect(result[:type]).to eq("income")
        expect(result[:category]).to eq("Salary")
      end

      it "converts type to lowercase" do
        row = ["2024-01-01", "Test", "100", "INCOME", "Salary"]
        result = operation.send(:parse_row_data, row)

        expect(result[:type]).to eq("income")
      end

      it "converts amount to integer" do
        row = ["2024-01-01", "Test", "100.50", "income", "Salary"]
        result = operation.send(:parse_row_data, row)

        expect(result[:amount]).to eq(100)
      end
    end

    describe "#validate_row" do
      let(:row_data) do
        {
          date: "2024-01-01",
          description: "Test",
          amount: 100,
          type: "income",
          category: "Salary"
        }
      end

      context "when row is valid" do
        it "returns success with category and parsed date" do
          result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

          expect(result[:success]).to be true
          expect(result[:category]).to eq(income_category)
          expect(result[:parsed_date]).to eq(Date.parse("2024-01-01"))
          expect(result).not_to have_key(:errors)
        end
      end

      context "when date is invalid" do
        context "when date is blank" do
          let(:row_data) do
            {
              date: "",
              description: "Test",
              amount: 100,
              type: "income",
              category: "Salary"
            }
          end

          it "returns success (blank date is handled by validate_date_format returning nil)" do
            result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

            expect(result[:success]).to be true
            expect(result[:parsed_date]).to be_nil
          end
        end

        context "when date format is wrong" do
          let(:row_data) do
            {
              date: "01-01-2024",
              description: "Test",
              amount: 100,
              type: "income",
              category: "Salary"
            }
          end

          it "returns failure with date format error" do
            result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

            expect(result[:success]).to be false
            expect(result[:errors]).to include("Date must be in YYYY-MM-DD format")
          end
        end

        context "when date is invalid but matches format" do
          let(:row_data) do
            {
              date: "2024-13-45",
              description: "Test",
              amount: 100,
              type: "income",
              category: "Salary"
            }
          end

          it "returns failure with invalid date error" do
            result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

            expect(result[:success]).to be false
            expect(result[:errors].any? { |e| e.include?("Invalid date format") }).to be true
          end
        end
      end

      context "when amount is invalid" do
        context "when amount is nil" do
          let(:row_data) do
            {
              date: "2024-01-01",
              description: "Test",
              amount: nil,
              type: "income",
              category: "Salary"
            }
          end

          it "returns failure with amount error" do
            result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

            expect(result[:success]).to be false
            expect(result[:errors]).to include("Amount must be greater than 0")
          end
        end

        context "when amount is zero" do
          let(:row_data) do
            {
              date: "2024-01-01",
              description: "Test",
              amount: 0,
              type: "income",
              category: "Salary"
            }
          end

          it "returns failure with amount error" do
            result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

            expect(result[:success]).to be false
            expect(result[:errors]).to include("Amount must be greater than 0")
          end
        end

        context "when amount is negative" do
          let(:row_data) do
            {
              date: "2024-01-01",
              description: "Test",
              amount: -100,
              type: "income",
              category: "Salary"
            }
          end

          it "returns failure with amount error" do
            result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

            expect(result[:success]).to be false
            expect(result[:errors]).to include("Amount must be greater than 0")
          end
        end
      end

      context "when type is invalid" do
        let(:row_data) do
          {
            date: "2024-01-01",
            description: "Test",
            amount: 100,
            type: "invalid",
            category: "Salary"
          }
        end

        it "returns failure with type error" do
          result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

          expect(result[:success]).to be false
          expect(result[:errors]).to include("Type must be 'income' or 'expense'")
        end
      end

      context "when category is not found" do
        let(:row_data) do
          {
            date: "2024-01-01",
            description: "Test",
            amount: 100,
            type: "income",
            category: "Unknown"
          }
        end

        it "returns failure with category error" do
          result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

          expect(result[:success]).to be false
          expect(result[:errors]).to include("Category 'Unknown' not found for type 'income'")
        end
      end

      context "when description is blank" do
        let(:row_data) do
          {
            date: "2024-01-01",
            description: "",
            amount: 100,
            type: "income",
            category: "Salary"
          }
        end

        it "returns success (description is optional)" do
          result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

          expect(result[:success]).to be true
        end
      end

      context "when multiple validations fail" do
        let(:row_data) do
          {
            date: "invalid",
            description: "Test",
            amount: 0,
            type: "invalid",
            category: "Unknown"
          }
        end

        it "returns all errors" do
          result = operation.send(:validate_row, row_data: row_data, row_number: 1, category_map: category_map)

          expect(result[:success]).to be false
          expect(result[:errors].length).to be >= 4
        end
      end
    end

    describe "#validate_date_format" do
      context "when date is valid" do
        it "returns parsed date" do
          errors = []
          result = operation.send(:validate_date_format, "2024-01-01", errors)

          expect(result).to eq(Date.parse("2024-01-01"))
          expect(errors).to be_empty
        end
      end

      context "when date is blank" do
        it "returns nil without adding error" do
          errors = []
          result = operation.send(:validate_date_format, "", errors)

          expect(result).to be_nil
          expect(errors).to be_empty
        end
      end

      context "when date format is wrong" do
        it "returns nil and adds format error" do
          errors = []
          result = operation.send(:validate_date_format, "01-01-2024", errors)

          expect(result).to be_nil
          expect(errors).to include("Date must be in YYYY-MM-DD format")
        end
      end

      context "when date is invalid but matches format" do
        it "returns nil and adds invalid date error" do
          errors = []
          result = operation.send(:validate_date_format, "2024-13-45", errors)

          expect(result).to be_nil
          expect(errors.any? { |e| e.include?("Invalid date format") }).to be true
        end
      end
    end

    describe "#create_failed_import_record" do
      let(:row_data) do
        {
          date: "invalid",
          description: "Test",
          amount: 0,
          type: "income",
          category: "Salary"
        }
      end

      let(:errors) { ["Date must be in YYYY-MM-DD format", "Amount must be greater than 0"] }

      it "creates a failed import record" do
        expect do
          operation.send(
            :create_failed_import_record,
            import: import,
            row_number: 1,
            row_data: row_data,
            errors: errors
          )
        end.to change(Imports::ImportRecord, :count).by(1)
      end

      it "creates record with correct attributes" do
        record = operation.send(
          :create_failed_import_record,
          import: import,
          row_number: 1,
          row_data: row_data,
          errors: errors
        )

        expect(record.import).to eq(import)
        expect(record.row_number).to eq(1)
        expect(record.original_data).to eq(row_data.stringify_keys)
        expect(record.status).to eq("failed")
        expect(record.import_errors).to eq(errors)
      end

      context "when errors array is empty" do
        it "uses default error message" do
          record = operation.send(
            :create_failed_import_record,
            import: import,
            row_number: 1,
            row_data: row_data,
            errors: []
          )

          expect(record.import_errors).to eq(["Record validation failed"])
        end
      end

      context "when errors contain nil values" do
        it "filters out nil values" do
          record = operation.send(
            :create_failed_import_record,
            import: import,
            row_number: 1,
            row_data: row_data,
            errors: ["Error 1", nil, "Error 2", nil]
          )

          expect(record.import_errors).to eq(["Error 1", "Error 2"])
        end
      end

      context "when errors contain empty strings" do
        it "filters out empty strings" do
          record = operation.send(
            :create_failed_import_record,
            import: import,
            row_number: 1,
            row_data: row_data,
            errors: ["Error 1", "", "Error 2", "   "]
          )

          expect(record.import_errors).to eq(["Error 1", "Error 2"])
        end
      end

      context "when creation raises an error" do
        before do
          allow(Imports::ImportRecord).to receive(:create!).and_raise(StandardError.new("Database error"))
        end

        it "logs the error" do
          operation.send(
            :create_failed_import_record,
            import: import,
            row_number: 1,
            row_data: row_data,
            errors: errors
          )

          expect(Rails.logger).to have_received(:error).with(/Failed to create failed import record/)
        end

        it "does not raise an error" do
          expect do
            operation.send(
              :create_failed_import_record,
              import: import,
              row_number: 1,
              row_data: row_data,
              errors: errors
            )
          end.not_to raise_error
        end
      end
    end
  end
end
