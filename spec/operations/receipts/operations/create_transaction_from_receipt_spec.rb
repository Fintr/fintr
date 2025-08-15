# frozen_string_literal: true

require "rails_helper"

RSpec.describe Receipts::Operations::CreateTransactionFromReceipt, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:user_id) { user.id }
  let(:space_id) { space.id }

  let(:base_receipt_data) do
    {
      total_amount: { value: "100.00", confidence_score: 0.9 },
      category: { value: "Groceries", confidence_score: 0.8 },
      merchant: { value: "Whole Foods", confidence_score: 0.95 },
      date: { value: Date.current.to_s, confidence_score: 0.9 }
    }
  end

  describe "Contract" do
    context "with valid parameters" do
      let(:receipt_data) { base_receipt_data }
      let(:params) { { user_id:, space_id:, receipt_data: } }

      it "is successful" do
        result = operation.validate(params:)
        expect(result).to be_success
        expect(result.value!).to include(user_id:, space_id:, receipt_data:)
      end
    end

    context "with invalid parameters" do
      context "when user_id is missing" do
        let(:params) { { space_id:, receipt_data: base_receipt_data } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(user_id: ['is missing'])
        end
      end

      context "when space_id is missing" do
        let(:params) { { user_id:, receipt_data: base_receipt_data } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(space_id: ['is missing'])
        end
      end

      context "when receipt_data is missing" do
        let(:params) { { user_id:, space_id: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(receipt_data: ['is missing'])
        end
      end

      context "when receipt_data does not contain essential data" do
        let(:receipt_data) { { some_other_field: "value" } }
        let(:params) { { user_id:, space_id:, receipt_data: } }

        it "fails with an error" do
          result = operation.validate(params:)
          expect(result).to be_failure
          expect(result.failure).to include(receipt_data: ['must contain merchant or total_amount'])
        end
      end
    end
  end

  describe "#call" do
    let(:transaction_params) do
      {
        user_id:,
        space_id:,
        amount: 100.00,
        date: Date.current,
        category_name: "Groceries",
        account_name: "Credit Card",
        description: "Receipt from Whole Foods (90% confidence) [Auto-processed from receipt]",
        schedule_type: "one_time"
      }
    end
    let(:transaction) { instance_double(Transactions::Transaction) }

    let(:mock_create_transaction_contract) { instance_double(Transactions::Operations::CreateTransaction::Contract) }
    let(:mock_create_transaction_operation) { instance_double(Transactions::Operations::CreateTransaction) }

    before do
      allow(Transactions::Operations::CreateTransaction::Contract).to receive(:new).and_return(mock_create_transaction_contract)
      allow(Transactions::Operations::CreateTransaction).to receive(:new).and_return(mock_create_transaction_operation)
      allow(mock_create_transaction_contract).to receive(:call).and_return(instance_double(Dry::Validation::Result, success?: true, to_h: transaction_params))
      allow(mock_create_transaction_operation).to receive(:call).and_return(Dry::Monads::Success(transaction))
    end

    context "when all steps are successful" do
      it "returns a successful result with the created transaction" do
        result = operation.call(params: { user_id:, space_id:, receipt_data: base_receipt_data })
        expect(result).to be_success
        expect(result.value!).to eq(transaction)
      end
    end

    context "when a step fails" do
      context "when validate_transaction_params fails" do
        let(:validation_errors) { { amount: ['must be greater than 0'] } }

        before do
          allow(mock_create_transaction_contract).to receive(:call).and_return(instance_double(Dry::Validation::Result, success?: false, errors: validation_errors))
        end

        it "returns a failure" do
          result = operation.call(params: { user_id:, space_id:, receipt_data: base_receipt_data })
          expect(result).to be_failure
          expect(result.failure).to include(validation_errors)
        end
      end

      context "when create_transaction fails" do
        let(:create_transaction_errors) { { name: ['cannot be blank'] } }

        before do
          allow(mock_create_transaction_operation).to receive(:call).and_return(Dry::Monads::Failure(create_transaction_errors))
        end

        it "returns a failure" do
          result = operation.call(params: { user_id:, space_id:, receipt_data: base_receipt_data })
          expect(result).to be_failure
          expect(result.failure).to include(
            create_transaction_errors.merge(
              context: "receipt_transaction_creation"
            )
          )
        end
      end
    end
  end

  describe "Private Methods" do
    describe "#build_transaction_params" do
      it "builds transaction parameters correctly from receipt data" do
        result = operation.__send__(:build_transaction_params, params: { user_id:, space_id:, receipt_data: base_receipt_data })
        expect(result).to be_success
        expect(result.value!).to include(
          user_id:,
          space_id:,
          amount: 100.00,
          date: Date.current,
          category_name: "Groceries",
          account_name: "Debit Card", # Changed from Credit Card based on determine_account_name logic
          description: "Receipt from Whole Foods (90% confidence) [Auto-processed from receipt]",
          schedule_type: "one_time"
        )
      end

      context "when receipt data is partial" do
        let(:partial_receipt_data) do
          {
            total_amount: { value: "50.00" },
            merchant: { value: "Cafe" }
          }
        end

        it "builds with defaults for missing fields" do
          result = operation.__send__(:build_transaction_params, params: { user_id:, space_id:, receipt_data: partial_receipt_data })
          expect(result).to be_success
          expect(result.value!).to include(
            user_id:,
            space_id:,
            amount: 50.00,
            date: Date.current, # Defaults to current date
            category_name: "Family", # Defaults to Family
            account_name: "Cash", # Defaults based on merchant
            description: "Receipt from Cafe [Auto-processed from receipt]", # Removed 0% confidence as score is missing
            schedule_type: "one_time"
          )
        end
      end
    end

    describe "#extract_amount" do
      it "extracts amount from string value" do
        receipt = { total_amount: { value: "$123.45" } }
        expect(operation.__send__(:extract_amount, receipt)).to eq(123.45)
      end

      it "extracts amount from numeric value" do
        receipt = { total_amount: { value: 200.50 } }
        expect(operation.__send__(:extract_amount, receipt)).to eq(200.50)
      end

      it "returns 0.0 if total_amount is missing" do
        expect(operation.__send__(:extract_amount, {})).to eq(0.0)
      end

      it "returns 0.0 if total_amount value is missing" do
        receipt = { total_amount: {} }
        expect(operation.__send__(:extract_amount, receipt)).to eq(0.0)
      end

      it "returns 0.0 for non-numeric string" do
        receipt = { total_amount: { value: "abc" } }
        expect(operation.__send__(:extract_amount, receipt)).to eq(0.0)
      end
    end

    describe "#extract_date" do
      it "extracts date from valid string value" do
        receipt = { date: { value: "2023-01-15" } }
        expect(operation.__send__(:extract_date, receipt)).to eq(Date.parse("2023-01-15"))
      end

      it "returns current date if date value is invalid" do
        receipt = { date: { value: "not-a-date" } }
        allow(Date).to receive(:current).and_return(Date.parse("2023-01-01"))
        expect(operation.__send__(:extract_date, receipt)).to eq(Date.parse("2023-01-01"))
      end

      it "returns current date if date is missing" do
        allow(Date).to receive(:current).and_return(Date.parse("2023-01-01"))
        expect(operation.__send__(:extract_date, {})).to eq(Date.parse("2023-01-01"))
      end
    end

    describe "#extract_category" do
      it "extracts category from present value" do
        receipt = { category: { value: "Dining" } }
        expect(operation.__send__(:extract_category, receipt)).to eq("Dining")
      end

      it "returns 'Family' if category value is blank" do
        receipt = { category: { value: "" } }
        expect(operation.__send__(:extract_category, receipt)).to eq("Family")
      end

      it "returns 'Family' if category is missing" do
        expect(operation.__send__(:extract_category, {})).to eq("Family")
      end
    end

    describe "#build_description" do
      context "when merchant and confidence are present" do
        let(:receipt_data_full) do
          {
            total_amount: { confidence_score: 0.9 },
            merchant: { value: "Grocery Store" }
          }
        end

        it "builds a full description" do
          description = operation.__send__(:build_description, receipt_data_full)
          expect(description).to eq("Receipt from Grocery Store (90% confidence) [Auto-processed from receipt]")
        end
      end

      context "when only merchant is present" do
        let(:receipt_data_merchant_only) do
          {
            merchant: { value: "Bookstore" }
          }
        end

        it "builds description with only merchant" do
          description = operation.__send__(:build_description, receipt_data_merchant_only)
          expect(description).to eq("Receipt from Bookstore [Auto-processed from receipt]")
        end
      end

      context "when only total_amount confidence is present" do
        let(:receipt_data_confidence_only) do
          {
            total_amount: { confidence_score: 0.75 }
          }
        end

        it "builds description with only confidence" do
          description = operation.__send__(:build_description, receipt_data_confidence_only)
          expect(description).to eq("Receipt transaction (75% confidence) [Auto-processed from receipt]")
        end
      end

      context "when no merchant or confidence is present" do
        it "builds a generic description" do
          description = operation.__send__(:build_description, {})
          expect(description).to eq("Receipt transaction [Auto-processed from receipt]")
        end
      end
    end

    describe "#determine_account_name" do
      context "when merchant is for gas/fuel" do
        it "returns Credit Card" do
          receipt = { merchant: { value: "Shell Gas Station" } }
          expect(operation.__send__(:determine_account_name, receipt)).to eq("Credit Card")
        end
      end

      context "when merchant is for grocery/food" do
        it "returns Debit Card" do
          receipt = { merchant: { value: "Local Market" } }
          expect(operation.__send__(:determine_account_name, receipt)).to eq("Debit Card")
        end
      end

      context "when merchant is for restaurant/cafe" do
        it "returns Cash" do
          receipt = { merchant: { value: "Starbucks Cafe" } }
          expect(operation.__send__(:determine_account_name, receipt)).to eq("Cash")
        end
      end

      context "when merchant does not match any specific pattern" do
        it "returns Credit Card as default" do
          receipt = { merchant: { value: "Electronics Store" } }
          expect(operation.__send__(:determine_account_name, receipt)).to eq("Credit Card")
        end
      end

      context "when merchant is missing" do
        it "returns Credit Card as default" do
          expect(operation.__send__(:determine_account_name, {})).to eq("Credit Card")
        end
      end
    end

    describe "#validate_transaction_params" do
      let(:valid_transaction_params) do
        {
          user_id:,
          space_id:,
          amount: 100.00,
          date: Date.current,
          category_name: "Groceries",
          account_name: "Credit Card",
          description: "Test description",
          schedule_type: "one_time"
        }
      end

      let(:mock_contract) { instance_double(Transactions::Operations::CreateTransaction::Contract) }

      before do
        # Stub the contract call to control validation outcome
        allow(Transactions::Operations::CreateTransaction::Contract).to receive(:new).and_return(mock_contract)
      end

      context "when transaction params are valid" do
        before do
          allow(mock_contract).to receive(:call).with(**valid_transaction_params).and_return(instance_double(Dry::Validation::Result, success?: true, to_h: valid_transaction_params))
        end

        it "returns success with validated params" do
          result = operation.__send__(:validate_transaction_params, transaction_params: valid_transaction_params)
          expect(result).to be_success
          expect(result.value!).to eq(valid_transaction_params)
        end
      end

      context "when transaction params are invalid" do
        let(:errors) { { amount: ['must be greater than 0'] } }

        before do
          allow(mock_contract).to receive(:call).with(**valid_transaction_params).and_return(instance_double(Dry::Validation::Result, success?: false, errors: errors))
        end

        it "returns failure with errors" do
          result = operation.__send__(:validate_transaction_params, transaction_params: valid_transaction_params)
          expect(result).to be_failure
          expect(result.failure).to eq(errors)
        end
      end
    end

    describe "#create_transaction" do
      let(:valid_transaction_params) do
        {
          user_id:,
          space_id:,
          amount: 100.00,
          date: Date.current,
          category_name: "Groceries",
          account_name: "Credit Card",
          description: "Test description",
          schedule_type: "one_time"
        }
      end

      let(:mock_create_transaction_op) { instance_double(Transactions::Operations::CreateTransaction) }

      before do
        # Stub the operation call to control outcome
        allow(Transactions::Operations::CreateTransaction).to receive(:new).and_return(mock_create_transaction_op)
      end

      context "when transaction creation is successful" do
        let(:created_transaction) { instance_double(Transactions::Transaction, id: "some-uuid") }

        before do
          allow(mock_create_transaction_op).to receive(:call).with(valid_transaction_params).and_return(Dry::Monads::Success(created_transaction))
        end

        it "returns success with the created transaction" do
          result = operation.__send__(:create_transaction, validated_params: valid_transaction_params)
          expect(result).to be_success
          expect(result.value!).to eq(created_transaction)
        end
      end

      context "when transaction creation fails" do
        let(:original_failure) { { name: ['cannot be blank'] } }

        before do
          allow(mock_create_transaction_op).to receive(:call).with(valid_transaction_params).and_return(Dry::Monads::Failure(original_failure))
        end

        it "returns failure with enhanced context" do
          result = operation.__send__(:create_transaction, validated_params: valid_transaction_params)
          expect(result).to be_failure
          expect(result.failure).to include(
            original_failure.merge(
              context: "receipt_transaction_creation",
              original_receipt_data: valid_transaction_params
            )
          )
        end
      end
    end
  end
end
