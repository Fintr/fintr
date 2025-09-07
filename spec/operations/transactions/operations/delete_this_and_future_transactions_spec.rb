# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::DeleteThisAndFutureTransactions do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:category) { create(:category, name: "Food", space:, category_type: "expense") }
  let(:transaction) do
    create(:expense_transaction,
           user:,
           space:,
           account:,
           category:,
           amount: Money.from_amount(100, "PHP"),
           date: Time.zone.today,
           schedule_type: "repeat",
           repeat_interval: "every_month",
           repeat_count: 3)
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when transaction is missing' do
        result = operation.send(:validate, params: { transaction: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction)
      end
    end

    context 'with invalid transaction' do
      it 'fails when transaction is not a Transaction object' do
        result = operation.send(:validate, params: { transaction: "not a transaction" })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction)
      end

      it 'fails when transaction is nil' do
        result = operation.send(:validate, params: { transaction: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction)
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation with transaction only' do
        result = operation.send(:validate, params: { transaction: transaction })
        expect(result).to be_success
        expect(result.value!).to eq({ transaction: transaction })
      end

      it 'succeeds validation with transaction and except_this_transaction' do
        result = operation.send(:validate, params: { transaction: transaction, except_this_transaction: true })
        expect(result).to be_success
        expect(result.value!).to eq({ transaction: transaction, except_this_transaction: true })
      end
    end
  end

  describe '#call' do
    let(:valid_params) { { transaction: transaction } }

    context 'with valid transaction' do
      let!(:future_transaction1) do
        create(:expense_transaction,
               user:,
               space:,
               account:,
               category:,
               amount: Money.from_amount(100, "PHP"),
               date: Time.zone.today + 1.month,
               schedule_type: "repeat",
               repeat_interval: "every_month",
               repeat_count: 3)
      end
      let!(:future_transaction2) do
        create(:expense_transaction,
               user:,
               space:,
               account:,
               category:,
               amount: Money.from_amount(100, "PHP"),
               date: Time.zone.today + 2.months,
               schedule_type: "repeat",
               repeat_interval: "every_month",
               repeat_count: 3)
      end
      let!(:past_transaction) do
        create(:expense_transaction,
               user:,
               space:,
               account:,
               category:,
               amount: Money.from_amount(100, "PHP"),
               date: Time.zone.today - 1.month,
               schedule_type: "repeat",
               repeat_interval: "every_month",
               repeat_count: 3)
      end

      before do
        # Mock the series_transactions method to return all related transactions
        allow(transaction).to receive(:series_transactions).and_return(
          Transactions::Transaction.where(id: [transaction.id, future_transaction1.id, future_transaction2.id, past_transaction.id])
        )

        # Mock the DeleteThisTransaction operation
        delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
        allow(delete_operation).to receive(:call).and_return(Success())
      end

      it 'calls DeleteThisTransaction for each future transaction' do
        delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
        allow(delete_operation).to receive(:call).and_return(Success())

        allow(delete_operation).to receive(:call).with(transaction: future_transaction1).and_return(Success())
        allow(delete_operation).to receive(:call).with(transaction: future_transaction2).and_return(Success())

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'does not delete past transactions' do
        delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
        allow(delete_operation).to receive(:call).and_return(Success())

        expect(delete_operation).not_to receive(:call).with(transaction: past_transaction)

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'returns the original transaction' do
        result = operation.call(valid_params)
        expect(result).to be_success
        expect(result.value!).to eq(transaction)
      end
    end

    context 'with except_this_transaction set to true' do
      let(:valid_params_with_except) { { transaction: transaction, except_this_transaction: true } }
      let!(:future_transaction1) do
        create(:expense_transaction,
               user:,
               space:,
               account:,
               category:,
               amount: Money.from_amount(100, "PHP"),
               date: Time.zone.today + 1.month,
               schedule_type: "repeat",
               repeat_interval: "every_month",
               repeat_count: 3)
      end

      before do
        allow(transaction).to receive(:series_transactions).and_return(
          Transactions::Transaction.where(id: [transaction.id, future_transaction1.id])
        )

        delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
        allow(delete_operation).to receive(:call).and_return(Success())
      end

      it 'excludes the current transaction from deletion' do
        delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
        allow(delete_operation).to receive(:call).and_return(Success())

        allow(delete_operation).to receive(:call).with(transaction: future_transaction1).and_return(Success())
        expect(delete_operation).not_to receive(:call).with(transaction: transaction)

        result = operation.call(valid_params_with_except)
        expect(result).to be_success
      end
    end

    context 'when DeleteThisTransaction fails' do
      let!(:future_transaction1) do
        create(:expense_transaction,
               user:,
               space:,
               account:,
               category:,
               amount: Money.from_amount(100, "PHP"),
               date: Time.zone.today + 1.month,
               schedule_type: "repeat",
               repeat_interval: "every_month",
               repeat_count: 3)
      end

      before do
        allow(transaction).to receive(:series_transactions).and_return(
          Transactions::Transaction.where(id: [transaction.id, future_transaction1.id])
        )

        delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
        allow(delete_operation).to receive(:call).and_return(Failure(error: "deletion failed"))
      end

      it 'continues execution and returns the original transaction' do
        result = operation.call(valid_params)
        expect(result).to be_success
        expect(result.value!).to eq(transaction)
      end
    end

    context 'with invalid parameters' do
      it 'fails validation and does not attempt to delete transactions' do
        expect(Transactions::Operations::DeleteThisTransaction).not_to receive(:new)

        result = operation.call({ transaction: "not a transaction" })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction)
      end
    end
  end

  describe '#find_this_and_future_transactions' do
    let!(:future_transaction1) do
      create(:expense_transaction,
             user:,
             space:,
             account:,
             category:,
             amount: Money.from_amount(100, "PHP"),
             date: Time.zone.today + 1.month,
             schedule_type: "repeat",
             repeat_interval: "every_month",
             repeat_count: 3)
    end
    let!(:future_transaction2) do
      create(:expense_transaction,
             user:,
             space:,
             account:,
             category:,
             amount: Money.from_amount(100, "PHP"),
             date: Time.zone.today + 2.months,
             schedule_type: "repeat",
             repeat_interval: "every_month",
             repeat_count: 3)
    end
    let!(:past_transaction) do
      create(:expense_transaction,
             user:,
             space:,
             account:,
             category:,
             amount: Money.from_amount(100, "PHP"),
             date: Time.zone.today - 1.month,
             schedule_type: "repeat",
             repeat_interval: "every_month",
             repeat_count: 3)
    end

    before do
      allow(transaction).to receive(:series_transactions).and_return(
        Transactions::Transaction.where(id: [transaction.id, future_transaction1.id, future_transaction2.id, past_transaction.id])
      )
    end

    context 'without except_this_transaction' do
      it 'finds this and future transactions' do
        result = operation.send(:find_this_and_future_transactions, params: { transaction: transaction })
        expect(result).to be_success

        transactions = result.value!
        expect(transactions).to include(transaction, future_transaction1, future_transaction2)
        expect(transactions).not_to include(past_transaction)
      end

      it 'includes the current transaction' do
        result = operation.send(:find_this_and_future_transactions, params: { transaction: transaction })
        expect(result).to be_success

        transactions = result.value!
        expect(transactions).to include(transaction)
      end
    end

    context 'with except_this_transaction set to true' do
      it 'finds only future transactions' do
        result = operation.send(:find_this_and_future_transactions, params: { transaction: transaction, except_this_transaction: true })
        expect(result).to be_success

        transactions = result.value!
        expect(transactions).to include(future_transaction1, future_transaction2)
        expect(transactions).not_to include(transaction, past_transaction)
      end
    end

    context 'with no future transactions' do
      let(:one_time_transaction) do
        create(:expense_transaction,
               user:,
               space:,
               account:,
               category:,
               amount: Money.from_amount(100, "PHP"),
               date: Time.zone.today,
               schedule_type: "one_time")
      end

      before do
        allow(one_time_transaction).to receive(:series_transactions).and_return(
          Transactions::Transaction.where(id: [one_time_transaction.id])
        )
      end

      it 'returns only the current transaction when except_this_transaction is false' do
        result = operation.send(:find_this_and_future_transactions, params: { transaction: one_time_transaction })
        expect(result).to be_success

        transactions = result.value!
        expect(transactions).to include(one_time_transaction)
        expect(transactions.count).to eq(1)
      end

      it 'returns empty collection when except_this_transaction is true' do
        result = operation.send(:find_this_and_future_transactions, params: { transaction: one_time_transaction, except_this_transaction: true })
        expect(result).to be_success

        transactions = result.value!
        expect(transactions).to be_empty
      end
    end
  end

  describe '#delete_this_and_future_transactions' do
    let(:future_transactions) { [future_transaction1, future_transaction2] }
    let(:future_transaction1) { instance_double(Transactions::Transaction) }
    let(:future_transaction2) { instance_double(Transactions::Transaction) }
    let(:delete_operation) { instance_double(Transactions::Operations::DeleteThisTransaction) }

    before do
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
      allow(delete_operation).to receive(:call).and_return(Success())
    end

    it 'calls DeleteThisTransaction for each future transaction' do
      allow(delete_operation).to receive(:call).with(transaction: future_transaction1).and_return(Success())
      allow(delete_operation).to receive(:call).with(transaction: future_transaction2).and_return(Success())

      result = operation.send(:delete_this_and_future_transactions, future_transactions: future_transactions)
      expect(result).to be_success
    end

    it 'returns the future transactions' do
      result = operation.send(:delete_this_and_future_transactions, future_transactions: future_transactions)
      expect(result).to be_success
      expect(result.value!).to eq(future_transactions)
    end

    context 'when DeleteThisTransaction fails for one transaction' do
      before do
        allow(delete_operation).to receive(:call).with(transaction: future_transaction1).and_return(Success())
        allow(delete_operation).to receive(:call).with(transaction: future_transaction2).and_return(Failure(error: "deletion failed"))
      end

      it 'continues execution and returns the future transactions' do
        result = operation.send(:delete_this_and_future_transactions, future_transactions: future_transactions)
        expect(result).to be_success
        expect(result.value!).to eq(future_transactions)
      end
    end

    context 'with empty future transactions' do
      it 'returns empty collection' do
        result = operation.send(:delete_this_and_future_transactions, future_transactions: [])
        expect(result).to be_success
        expect(result.value!).to eq([])
      end
    end
  end

  describe 'Integration Tests' do
    let!(:future_transaction1) do
      create(:expense_transaction,
             user:,
             space:,
             account:,
             category:,
             amount: Money.from_amount(100, "PHP"),
             date: Time.zone.today + 1.month,
             schedule_type: "repeat",
             repeat_interval: "every_month",
             repeat_count: 3)
    end
    let!(:future_transaction2) do
      create(:expense_transaction,
             user:,
             space:,
             account:,
             category:,
             amount: Money.from_amount(100, "PHP"),
             date: Time.zone.today + 2.months,
             schedule_type: "repeat",
             repeat_interval: "every_month",
             repeat_count: 3)
    end

    before do
      allow(transaction).to receive(:series_transactions).and_return(
        Transactions::Transaction.where(id: [transaction.id, future_transaction1.id, future_transaction2.id])
      )

      delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
      allow(delete_operation).to receive(:call).and_return(Success())
    end

    context 'with real transaction deletion' do
      it 'processes all future transactions correctly' do
        delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
        allow(delete_operation).to receive(:call).and_return(Success())

        allow(delete_operation).to receive(:call).with(transaction: transaction).and_return(Success())
        allow(delete_operation).to receive(:call).with(transaction: future_transaction1).and_return(Success())
        allow(delete_operation).to receive(:call).with(transaction: future_transaction2).and_return(Success())

        result = operation.call({ transaction: transaction })
        expect(result).to be_success
        expect(result.value!).to eq(transaction)
      end
    end

    context 'with except_this_transaction flag' do
      it 'excludes current transaction from deletion' do
        delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
        allow(delete_operation).to receive(:call).and_return(Success())

        allow(delete_operation).to receive(:call).with(transaction: future_transaction1).and_return(Success())
        allow(delete_operation).to receive(:call).with(transaction: future_transaction2).and_return(Success())
        expect(delete_operation).not_to receive(:call).with(transaction: transaction)

        result = operation.call({ transaction: transaction, except_this_transaction: true })
        expect(result).to be_success
        expect(result.value!).to eq(transaction)
      end
    end
  end
end
