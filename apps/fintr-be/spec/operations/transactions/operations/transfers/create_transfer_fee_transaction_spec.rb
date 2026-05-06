# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::CreateTransferFeeTransaction do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:transfer) do
    create(:transfer,
           user:,
           space:,
           from_account:,
           to_account:,
           amount: Money.from_amount(100, "PHP"),
           transaction_cost: Money.from_amount(10, "PHP"),
           date: Time.zone.today,
           schedule_type: "one_time")
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when transfer_id is missing' do
        result = operation.validate(params: {
          user_id: user.id,
          space_id: space.id,
          transaction_cost: 10.0,
          transaction_cost_currency: "PHP",
          date: Time.zone.today
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer_id)
      end

      it 'fails when user_id is missing' do
        result = operation.validate(params: {
          transfer_id: transfer.id,
          space_id: space.id,
          transaction_cost: 10.0,
          transaction_cost_currency: "PHP",
          date: Time.zone.today
        })
        expect(result).to be_failure
        expect(result.failure).to include(:user_id)
      end

      it 'fails when space_id is missing' do
        result = operation.validate(params: {
          transfer_id: transfer.id,
          user_id: user.id,
          transaction_cost: 10.0,
          transaction_cost_currency: "PHP",
          date: Time.zone.today
        })
        expect(result).to be_failure
        expect(result.failure).to include(:space_id)
      end

      it 'fails when transaction_cost is missing' do
        result = operation.validate(params: {
          transfer_id: transfer.id,
          user_id: user.id,
          space_id: space.id,
          transaction_cost_currency: "PHP",
          date: Time.zone.today
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction_cost)
      end

      it 'fails when transaction_cost_currency is missing' do
        result = operation.validate(params: {
          transfer_id: transfer.id,
          user_id: user.id,
          space_id: space.id,
          transaction_cost: 10.0,
          date: Time.zone.today
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction_cost_currency)
      end

      it 'fails when date is missing' do
        result = operation.validate(params: {
          transfer_id: transfer.id,
          user_id: user.id,
          space_id: space.id,
          transaction_cost: 10.0,
          transaction_cost_currency: "PHP"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:date)
      end
    end

    context 'with invalid transaction_cost' do
      it 'fails when transaction_cost is negative' do
        result = operation.validate(params: {
          transfer_id: transfer.id,
          user_id: user.id,
          space_id: space.id,
          transaction_cost: -10.0,
          transaction_cost_currency: "PHP",
          date: Time.zone.today
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction_cost)
      end

      it 'fails when transaction_cost is zero' do
        result = operation.validate(params: {
          transfer_id: transfer.id,
          user_id: user.id,
          space_id: space.id,
          transaction_cost: 0.0,
          transaction_cost_currency: "PHP",
          date: Time.zone.today
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction_cost)
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation' do
        result = operation.validate(params: {
          transfer_id: transfer.id,
          user_id: user.id,
          space_id: space.id,
          transaction_cost: 10.0,
          transaction_cost_currency: "PHP",
          date: Time.zone.today,
          description: "Transfer fee",
          balance_state: "calculated"
        })
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    let(:valid_params) do
      {
        transfer_id: transfer.id,
        user_id: user.id,
        space_id: space.id,
        transaction_cost: 10.0,
        transaction_cost_currency: "PHP",
        date: Time.zone.today,
        description: "Transfer fee",
        balance_state: "calculated"
      }
    end

    context 'when transfer does not exist' do
      it 'returns not found error' do
        result = operation.call(params: {
          transfer_id: "non-existent-id",
          user_id: user.id,
          space_id: space.id,
          transaction_cost: 10.0,
          transaction_cost_currency: "PHP",
          date: Time.zone.today
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer_id)
      end
    end

    context 'with valid transfer' do
      let(:fee_category) { create(:category, name: "Transfer Fee", space:, category_type: "expense") }
      let(:find_or_create_operation) { instance_double(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory) }
      let(:setup_operation) { instance_double(Transactions::Operations::Transfers::SetupTransferFeeTransaction) }
      let(:calculate_balance_operation) { instance_double(Transactions::Operations::Accounts::CalculateBalance) }
      let(:fee_transaction) { instance_double(Transactions::Expense, id: "fee-123", save!: true) }

      before do
        # Stub external operations
        allow(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory).to receive(:new).and_return(find_or_create_operation)
        allow(find_or_create_operation).to receive(:call).and_return(Success(fee_category))

        allow(Transactions::Operations::Transfers::SetupTransferFeeTransaction).to receive(:new).and_return(setup_operation)
        allow(setup_operation).to receive(:call).and_return(Success(fee_transaction))

        allow(Transactions::Operations::Accounts::CalculateBalance).to receive(:new).and_return(calculate_balance_operation)
        allow(calculate_balance_operation).to receive(:call).and_return(Success())
      end

      it 'finds the transfer successfully' do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'finds or creates transfer fee category' do
        allow(find_or_create_operation).to receive(:call).with(valid_params).and_return(Success(fee_category))

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'creates fee transaction using setup operation' do
        allow(setup_operation).to receive(:call).with(
          params: valid_params,
          transfer: transfer,
          fee_category: fee_category
        ).and_return(Success(fee_transaction))

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'saves the fee transaction' do
        expect(fee_transaction).to receive(:save!)

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'calculates balance for the fee transaction' do
        allow(calculate_balance_operation).to receive(:call).with(transaction_id: "fee-123").and_return(Success())

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'returns the created fee transaction' do
        result = operation.call(valid_params)
        expect(result).to be_success
        expect(result.value!).to eq(fee_transaction)
      end
    end

    context 'when find_or_create_transfer_fee_category fails' do
      before do
        find_or_create_operation = instance_double(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory)
        allow(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory).to receive(:new).and_return(find_or_create_operation)
        allow(find_or_create_operation).to receive(:call).and_return(Failure(category: "could not create Transfer Fee category"))
      end

      it 'propagates the failure' do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:category)
      end
    end

    context 'when setup_transfer_fee_transaction fails' do
      before do
        find_or_create_operation = instance_double(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory)
        allow(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory).to receive(:new).and_return(find_or_create_operation)
        allow(find_or_create_operation).to receive(:call).and_return(Success(create(:category, name: "Transfer Fee", space:, category_type: "expense")))

        setup_operation = instance_double(Transactions::Operations::Transfers::SetupTransferFeeTransaction)
        allow(Transactions::Operations::Transfers::SetupTransferFeeTransaction).to receive(:new).and_return(setup_operation)
        allow(setup_operation).to receive(:call).and_return(Failure(error: "setup failed"))
      end

      it 'propagates the failure' do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end

    context 'when fee transaction save fails' do
      let(:fee_category) { create(:category, name: "Transfer Fee", space:, category_type: "expense") }
      let(:find_or_create_operation) { instance_double(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory) }
      let(:setup_operation) { instance_double(Transactions::Operations::Transfers::SetupTransferFeeTransaction) }
      let(:fee_transaction) { instance_double(Transactions::Expense, errors: instance_double(ActiveModel::Errors, to_hash: { amount: ["can't be blank"] }, full_messages: ["Amount can't be blank"])) }

      before do
        allow(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory).to receive(:new).and_return(find_or_create_operation)
        allow(find_or_create_operation).to receive(:call).and_return(Success(fee_category))

        allow(Transactions::Operations::Transfers::SetupTransferFeeTransaction).to receive(:new).and_return(setup_operation)
        allow(setup_operation).to receive(:call).and_return(Success(fee_transaction))

        allow(fee_transaction).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(create(:expense_transaction)))
      end

      it 'handles save failure gracefully' do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:fee_transaction)
      end
    end

    context 'when calculate_balance fails' do
      let(:fee_category) { create(:category, name: "Transfer Fee", space:, category_type: "expense") }
      let(:find_or_create_operation) { instance_double(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory) }
      let(:setup_operation) { instance_double(Transactions::Operations::Transfers::SetupTransferFeeTransaction) }
      let(:calculate_balance_operation) { instance_double(Transactions::Operations::Accounts::CalculateBalance) }
      let(:fee_transaction) { instance_double(Transactions::Expense, id: "fee-123", save!: true) }

      before do
        allow(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory).to receive(:new).and_return(find_or_create_operation)
        allow(find_or_create_operation).to receive(:call).and_return(Success(fee_category))

        allow(Transactions::Operations::Transfers::SetupTransferFeeTransaction).to receive(:new).and_return(setup_operation)
        allow(setup_operation).to receive(:call).and_return(Success(fee_transaction))

        allow(Transactions::Operations::Accounts::CalculateBalance).to receive(:new).and_return(calculate_balance_operation)
        allow(calculate_balance_operation).to receive(:call).and_return(Failure(error: "balance calculation failed"))
      end

      it 'propagates the balance calculation failure' do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end
  end

  describe '#find_transfer' do
    it 'finds the transfer successfully' do
      result = operation.send(:find_transfer, params: { transfer_id: transfer.id })
      expect(result).to be_success
      expect(result.value!).to eq(transfer)
    end

    it 'returns failure when transfer is not found' do
      result = operation.send(:find_transfer, params: { transfer_id: "non-existent" })
      expect(result).to be_failure
      expect(result.failure).to include(:transfer_id)
    end
  end

  describe '#find_or_create_transfer_fee_category' do
    it 'calls the FindOrCreateTransferFeeCategory operation' do
      find_or_create_operation = instance_double(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory)
      allow(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory).to receive(:new).and_return(find_or_create_operation)
      allow(find_or_create_operation).to receive(:call).and_return(Success(create(:category, name: "Transfer Fee", space:, category_type: "expense")))

      expect(find_or_create_operation).to receive(:call).with({ space_id: space.id })

      result = operation.send(:find_or_create_transfer_fee_category, params: { space_id: space.id })
      expect(result).to be_success
    end
  end

  describe '#create_fee_transaction' do
    let(:fee_category) { create(:category, name: "Transfer Fee", space:, category_type: "expense") }
    let(:setup_operation) { instance_double(Transactions::Operations::Transfers::SetupTransferFeeTransaction) }
    let(:fee_transaction) { instance_double(Transactions::Expense, id: "fee-123", save!: true) }

    before do
      allow(Transactions::Operations::Transfers::SetupTransferFeeTransaction).to receive(:new).and_return(setup_operation)
      allow(setup_operation).to receive(:call).and_return(Success(fee_transaction))
    end

    it 'calls setup operation with correct parameters' do
      allow(setup_operation).to receive(:call).with(
        params: { transfer_id: transfer.id },
        transfer: transfer,
        fee_category: fee_category
      ).and_return(Success(fee_transaction))

      result = operation.send(:create_fee_transaction,
                              params: { transfer_id: transfer.id },
                              transfer: transfer,
                              fee_category: fee_category)
      expect(result).to be_success
    end

    it 'saves the fee transaction' do
      expect(fee_transaction).to receive(:save!)

      result = operation.send(:create_fee_transaction,
                              params: { transfer_id: transfer.id },
                              transfer: transfer,
                              fee_category: fee_category)
      expect(result).to be_success
    end

    it 'returns the saved fee transaction' do
      result = operation.send(:create_fee_transaction,
                              params: { transfer_id: transfer.id },
                              transfer: transfer,
                              fee_category: fee_category)
      expect(result).to be_success
      expect(result.value!).to eq(fee_transaction)
    end

    context 'when save fails' do
      let(:fee_transaction_with_errors) { instance_double(Transactions::Expense, errors: instance_double(ActiveModel::Errors, to_hash: { amount: ["can't be blank"] }, full_messages: ["Amount can't be blank"])) }

      before do
        allow(setup_operation).to receive(:call).and_return(Success(fee_transaction_with_errors))
        allow(fee_transaction_with_errors).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(create(:expense_transaction)))
      end

      it 'handles save failure gracefully' do
        result = operation.send(:create_fee_transaction,
                                params: { transfer_id: transfer.id },
                                transfer: transfer,
                                fee_category: fee_category)
        expect(result).to be_failure
        expect(result.failure).to include(:fee_transaction)
      end
    end
  end

  describe '#calculate_balance' do
    let(:fee_transaction) { instance_double(Transactions::Expense, id: "fee-123") }
    let(:calculate_balance_operation) { instance_double(Transactions::Operations::Accounts::CalculateBalance) }

    before do
      allow(Transactions::Operations::Accounts::CalculateBalance).to receive(:new).and_return(calculate_balance_operation)
      allow(calculate_balance_operation).to receive(:call).and_return(Success())
    end

    it 'calls calculate balance operation with correct transaction_id' do
      allow(calculate_balance_operation).to receive(:call).with(transaction_id: "fee-123").and_return(Success())

      result = operation.send(:calculate_balance, fee_transaction: fee_transaction)
      expect(result).to be_success
    end

    it 'returns the result from calculate balance operation' do
      result = operation.send(:calculate_balance, fee_transaction: fee_transaction)
      expect(result).to be_success
    end
  end
end
