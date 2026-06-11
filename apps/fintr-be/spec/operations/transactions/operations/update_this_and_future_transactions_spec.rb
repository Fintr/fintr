# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::UpdateThisAndFutureTransactions do
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
        # Create a mock that responds to changed? but is nil
        nil_transaction = instance_double(Transactions::Transaction, changed?: false)
        allow(nil_transaction).to receive(:is_a?).with(Transactions::Transaction).and_return(false)
        result = operation.send(:validate, params: { transaction: nil_transaction })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction)
      end
    end

    context 'with invalid transaction' do
      it 'fails when transaction is not a Transaction object' do
        # Create a mock that responds to changed? but is not a Transaction
        invalid_transaction = instance_double(Transactions::Transaction, changed?: true)
        allow(invalid_transaction).to receive(:is_a?).with(Transactions::Transaction).and_return(false)
        result = operation.send(:validate, params: { transaction: invalid_transaction })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction)
      end

      it 'fails when transaction is not changed' do
        result = operation.send(:validate, params: { transaction: transaction })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction)
      end
    end

    context 'with valid parameters' do
      let(:changed_transaction) do
        transaction.amount = Money.from_amount(200, "PHP")
        transaction
      end

      it 'succeeds validation with transaction only' do
        result = operation.send(:validate, params: { transaction: changed_transaction })
        expect(result).to be_success
        expect(result.value!).to eq({ transaction: changed_transaction })
      end

      it 'succeeds validation with transaction and all_in_series' do
        result = operation.send(:validate, params: { transaction: changed_transaction, all_in_series: true })
        expect(result).to be_success
        expect(result.value!).to eq({ transaction: changed_transaction, all_in_series: true })
      end
    end
  end

  describe '#call' do
    let(:changed_transaction) do
      transaction.amount = Money.from_amount(200, "PHP")
      transaction
    end
    let(:valid_params) { { transaction: changed_transaction } }

    context 'with valid changed transaction' do
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
               repeat_count: 3,
               parent_id: transaction.id,
               effective_parent_id: transaction.id,
               balance_state: "pending")
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
               repeat_count: 3,
               parent_id: transaction.id,
               effective_parent_id: transaction.id,
               balance_state: "calculated")
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
               repeat_count: 3,
               parent_id: transaction.id,
               effective_parent_id: transaction.id,
               balance_state: "calculated")
      end

      before do
        # Mock the series_records method to return all related transactions
        allow(changed_transaction).to receive(:series_records).and_return(
          Transactions::Transaction.where(id: [transaction.id, future_transaction1.id, future_transaction2.id, past_transaction.id])
        )

        # Mock the root_parent method
        allow(changed_transaction).to receive(:root_parent).and_return(transaction)

        # Mock the CreateRepeatTransactions operation
        create_repeat_operation = instance_double(Transactions::Operations::CreateRepeatTransactions)
        allow(Transactions::Operations::CreateRepeatTransactions).to receive(:new).and_return(create_repeat_operation)
        allow(create_repeat_operation).to receive(:call).and_return(Success())

        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_call_original
      end

      it 'updates this and future transactions' do
        result = operation.call(valid_params)
        expect(result).to be_success
        expect(result.value!).to eq(changed_transaction)
      end

      it 'deletes pending transactions' do
        result = operation.call(valid_params)
        expect(result).to be_success

        # Check that pending transaction was deleted
        expect(Transactions::Transaction.find_by(id: future_transaction1.id)).to be_nil
      end

      it 'deletes calculated transactions using DeleteThisTransaction' do
        delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
        allow(delete_operation).to receive(:call).and_return(Success())

        allow(delete_operation).to receive(:call).with(transaction: future_transaction2).and_return(Success())

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'recreates past to present transactions when transaction date is in the past' do
        # Create a transaction with a past date
        past_transaction = create(:expense_transaction,
                                 user:,
                                 space:,
                                 account:,
                                 category:,
                                 amount: Money.from_amount(100, "PHP"),
                                 date: Time.zone.today - 1.day,
                                 schedule_type: "repeat",
                                 repeat_interval: "every_month",
                                 repeat_count: 3)
        past_transaction.amount = Money.from_amount(200, "PHP")

        create_repeat_operation = instance_double(Transactions::Operations::CreateRepeatTransactions)
        allow(Transactions::Operations::CreateRepeatTransactions).to receive(:new).and_return(create_repeat_operation)
        allow(create_repeat_operation).to receive(:call).and_return(Success())

        # Mock the series_records for the past transaction
        allow(past_transaction).to receive(:series_records).and_return(
          Transactions::Transaction.where(id: [past_transaction.id])
        )
        allow(past_transaction).to receive(:root_parent).and_return(past_transaction)

        # The operation calls CreateRepeatTransactions with a hash of parameters
        allow(create_repeat_operation).to receive(:call).with(
          hash_including(
            transaction: past_transaction,
            balance_state: "calculated",
            date_start: (past_transaction.date + 1.day).beginning_of_day.to_datetime,
            date_end: Time.zone.today
          )
        ).and_return(Success())

        result = operation.call({ transaction: past_transaction })
        expect(result).to be_success
      end

      it 'recreates future transactions' do
        create_repeat_operation = instance_double(Transactions::Operations::CreateRepeatTransactions)
        allow(Transactions::Operations::CreateRepeatTransactions).to receive(:new).and_return(create_repeat_operation)
        allow(create_repeat_operation).to receive(:call).and_return(Success())

        allow(create_repeat_operation).to receive(:call).with(
          hash_including(
            transaction: changed_transaction,
            balance_state: "pending",
            date_start: Time.zone.tomorrow,
            date_end: Time.zone.today + 1.month
          )
        ).and_return(Success())

        result = operation.call(valid_params)
        expect(result).to be_success
      end
    end

    context 'with all_in_series set to true' do
      let(:valid_params_with_all_in_series) { { transaction: changed_transaction, all_in_series: true } }
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
               repeat_count: 3,
               parent_id: transaction.id,
               effective_parent_id: transaction.id,
               balance_state: "calculated")
      end

      before do
        allow(changed_transaction).to receive(:series_records).and_return(
          Transactions::Transaction.where(id: [transaction.id, past_transaction.id])
        )

        allow(changed_transaction).to receive(:root_parent).and_return(transaction)

        create_repeat_operation = instance_double(Transactions::Operations::CreateRepeatTransactions)
        allow(Transactions::Operations::CreateRepeatTransactions).to receive(:new).and_return(create_repeat_operation)
        allow(create_repeat_operation).to receive(:call).and_return(Success())

        delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
        allow(delete_operation).to receive(:call).and_return(Success())
      end

      it 'includes past transactions in the update' do
        result = operation.call(valid_params_with_all_in_series)
        expect(result).to be_success

        # Check that past transaction's effective_parent_id was updated
        past_transaction.reload
        expect(past_transaction.effective_parent_id).to eq(changed_transaction.id)
      end
    end

    context 'when transaction date is today or in the future' do
      let(:future_transaction) do
        create(:expense_transaction,
               user:,
               space:,
               account:,
               category:,
               amount: Money.from_amount(100, "PHP"),
               date: Time.zone.today + 1.day,
               schedule_type: "repeat",
               repeat_interval: "every_month",
               repeat_count: 3)
      end
      let(:changed_future_transaction) do
        future_transaction.amount = Money.from_amount(200, "PHP")
        future_transaction
      end

      before do
        allow(changed_future_transaction).to receive(:series_records).and_return(
          Transactions::Transaction.where(id: [future_transaction.id])
        )

        allow(changed_future_transaction).to receive(:root_parent).and_return(future_transaction)

        create_repeat_operation = instance_double(Transactions::Operations::CreateRepeatTransactions)
        allow(Transactions::Operations::CreateRepeatTransactions).to receive(:new).and_return(create_repeat_operation)
        allow(create_repeat_operation).to receive(:call).and_return(Success())
      end

      it 'does not recreate past to present transactions' do
        create_repeat_operation = instance_double(Transactions::Operations::CreateRepeatTransactions)
        allow(Transactions::Operations::CreateRepeatTransactions).to receive(:new).and_return(create_repeat_operation)
        allow(create_repeat_operation).to receive(:call).and_return(Success())

        expect(create_repeat_operation).not_to receive(:call).with(
          transaction: changed_future_transaction,
          balance_state: "calculated",
          date_start: anything,
          date_end: Time.zone.today
        )

        result = operation.call({ transaction: changed_future_transaction })
        expect(result).to be_success
      end
    end

    context 'with invalid parameters' do
      it 'fails validation and does not attempt to update transactions' do
        expect(Transactions::Operations::CreateRepeatTransactions).not_to receive(:new)
        expect(Transactions::Operations::DeleteThisTransaction).not_to receive(:new)

        # Create a mock that responds to changed? but is not a Transaction
        invalid_transaction = instance_double(Transactions::Transaction, changed?: true)
        allow(invalid_transaction).to receive(:is_a?).with(Transactions::Transaction).and_return(false)

        result = operation.call({ transaction: invalid_transaction })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction)
      end
    end
  end

  describe '#find_transaction' do
    it 'returns the transaction from params' do
      result = operation.send(:find_transaction, params: { transaction: transaction })
      expect(result).to be_success
      expect(result.value!).to eq(transaction)
    end
  end

  describe '#find_previous_transactions' do
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
             repeat_count: 3,
             parent_id: transaction.id,
             effective_parent_id: transaction.id)
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
             repeat_count: 3,
             parent_id: transaction.id,
             effective_parent_id: transaction.id)
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
             repeat_count: 3,
             parent_id: transaction.id,
             effective_parent_id: transaction.id)
    end

    before do
      allow(transaction).to receive(:series_records).and_return(
        Transactions::Transaction.where(id: [transaction.id, future_transaction1.id, future_transaction2.id, past_transaction.id])
      )
    end

    context 'without all_in_series' do
      it 'finds transactions from transaction date onwards' do
        result = operation.send(:find_previous_transactions, transaction: transaction, params: {})
        expect(result).to be_success

        transactions = result.value!
        expect(transactions).to include(future_transaction1, future_transaction2)
        expect(transactions).not_to include(transaction, past_transaction)
      end
    end

    context 'with all_in_series set to true' do
      it 'finds all transactions in the series except the current one' do
        result = operation.send(:find_previous_transactions, transaction: transaction, params: { all_in_series: true })
        expect(result).to be_success

        transactions = result.value!
        expect(transactions).to include(future_transaction1, future_transaction2, past_transaction)
        expect(transactions).not_to include(transaction)
      end
    end
  end

  describe '#update_effective_parent' do
    let(:previous_transactions) { instance_double(ActiveRecord::Relation) }
    let(:future_transaction1) { instance_double(Transactions::Transaction) }
    let(:future_transaction2) { instance_double(Transactions::Transaction) }

    before do
      allow(previous_transactions).to receive(:update_all).and_return(2)
    end

    it 'updates effective_parent_id for all previous transactions' do
      allow(previous_transactions).to receive(:update_all).with(effective_parent_id: transaction.id).and_return(2)

      result = operation.send(:update_effective_parent, transaction: transaction, previous_transactions: previous_transactions)
      expect(result).to be_success
      expect(result.value!).to eq(previous_transactions)
    end
  end

  describe '#clear_schedules_from_series' do
    let(:root_parent) { instance_double(Transactions::Transaction, id: "root-123") }

    before do
      allow(transaction).to receive(:root_parent).and_return(root_parent)
      allow(Transactions::Transaction).to receive(:where).and_return(instance_double(ActiveRecord::Relation, update_all: 3))
    end

    it 'clears schedules from all transactions in the series except the reference transaction' do
      allow(Transactions::Transaction).to receive(:where).with(
        "(parent_id = :root_id OR id = :root_id) AND id != :reference_id",
        root_id: root_parent.id,
        reference_id: transaction.id
      ).and_return(instance_double(ActiveRecord::Relation, update_all: 3))

      result = operation.send(:clear_schedules_from_series, transaction: transaction)
      expect(result).to be_success
    end
  end

  describe '#find_pending_transactions' do
    let(:previous_transactions) { instance_double(ActiveRecord::Relation) }
    let(:pending_transactions) { [pending_transaction1, pending_transaction2] }
    let(:pending_transaction1) { instance_double(Transactions::Transaction) }
    let(:pending_transaction2) { instance_double(Transactions::Transaction) }

    before do
      allow(previous_transactions).to receive(:where).with(balance_state: "pending").and_return(pending_transactions)
    end

    it 'finds pending transactions from previous transactions' do
      result = operation.send(:find_pending_transactions, previous_transactions: previous_transactions)
      expect(result).to be_success
      expect(result.value!).to eq(pending_transactions)
    end
  end

  describe '#delete_pending_transactions' do
    let(:pending_transactions) { instance_double(ActiveRecord::Relation) }
    let(:pending_transaction1) { instance_double(Transactions::Transaction) }
    let(:pending_transaction2) { instance_double(Transactions::Transaction) }
    let(:delete_operation) { instance_double(Transactions::Operations::DeleteThisTransaction) }

    before do
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
      allow(delete_operation).to receive(:call).and_return(Success(true))
      allow(pending_transactions).to receive(:find_each).and_yield(pending_transaction1).and_yield(pending_transaction2)
    end

    it 'deletes pending transactions through DeleteThisTransaction' do
      result = operation.send(:delete_pending_transactions, pending_transactions: pending_transactions)
      expect(result).to be_success
      expect(result.value!).to eq(pending_transactions)
      expect(delete_operation).to have_received(:call).with(transaction: pending_transaction1)
      expect(delete_operation).to have_received(:call).with(transaction: pending_transaction2)
    end
  end

  describe '#find_calculated_transactions' do
    let(:previous_transactions) { instance_double(ActiveRecord::Relation) }
    let(:calculated_transactions) { [calculated_transaction1, calculated_transaction2] }
    let(:calculated_transaction1) { instance_double(Transactions::Transaction) }
    let(:calculated_transaction2) { instance_double(Transactions::Transaction) }

    before do
      allow(previous_transactions).to receive(:where).with(balance_state: "calculated").and_return(calculated_transactions)
    end

    it 'finds calculated transactions from previous transactions' do
      result = operation.send(:find_calculated_transactions, previous_transactions: previous_transactions)
      expect(result).to be_success
      expect(result.value!).to eq(calculated_transactions)
    end
  end

  describe '#delete_calculated_transactions' do
    let(:calculated_transactions) { instance_double(ActiveRecord::Relation) }
    let(:calculated_transaction1) { instance_double(Transactions::Transaction) }
    let(:calculated_transaction2) { instance_double(Transactions::Transaction) }
    let(:delete_operation) { instance_double(Transactions::Operations::DeleteThisTransaction) }

    before do
      allow(calculated_transactions).to receive(:find_each).and_yield(calculated_transaction1).and_yield(calculated_transaction2)
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
      allow(delete_operation).to receive(:call).and_return(Success())
    end

    it 'deletes each calculated transaction using DeleteThisTransaction' do
      allow(delete_operation).to receive(:call).with(transaction: calculated_transaction1).and_return(Success())
      allow(delete_operation).to receive(:call).with(transaction: calculated_transaction2).and_return(Success())

      result = operation.send(:delete_calculated_transactions, calculated_transactions: calculated_transactions)
      expect(result).to be_success
      expect(result.value!).to eq(calculated_transactions)
    end
  end

  describe '#recreate_past_to_present_transactions' do
    let(:create_repeat_operation) { instance_double(Transactions::Operations::CreateRepeatTransactions) }

    before do
      allow(Transactions::Operations::CreateRepeatTransactions).to receive(:new).and_return(create_repeat_operation)
      allow(create_repeat_operation).to receive(:call).and_return(Success())
    end

    context 'when transaction date is in the past' do
      let(:past_transaction) do
        create(:expense_transaction,
               user:,
               space:,
               account:,
               category:,
               amount: Money.from_amount(100, "PHP"),
               date: Time.zone.today - 1.day,
               schedule_type: "repeat",
               repeat_interval: "every_month",
               repeat_count: 3)
      end

      it 'creates repeat transactions from day after transaction until today' do
        allow(create_repeat_operation).to receive(:call).with(
          transaction: past_transaction,
          balance_state: "calculated",
          date_start: (past_transaction.date + 1.day).beginning_of_day.to_datetime,
          date_end: Time.zone.today
        ).and_return(Success())

        result = operation.send(:recreate_past_to_present_transactions, transaction: past_transaction)
        expect(result).to be_success
      end
    end

    context 'when transaction date is today or in the future' do
      it 'returns success without creating transactions' do
        expect(create_repeat_operation).not_to receive(:call)

        result = operation.send(:recreate_past_to_present_transactions, transaction: transaction)
        expect(result).to be_success
      end
    end
  end

  describe '#recreate_future_transactions' do
    let(:create_repeat_operation) { instance_double(Transactions::Operations::CreateRepeatTransactions) }

    before do
      allow(Transactions::Operations::CreateRepeatTransactions).to receive(:new).and_return(create_repeat_operation)
      allow(create_repeat_operation).to receive(:call).and_return(Success())
    end

    it 'creates repeat transactions from tomorrow onwards' do
      allow(create_repeat_operation).to receive(:call).with(
        transaction: transaction,
        balance_state: "pending",
        date_start: Time.zone.tomorrow,
        date_end: Time.zone.today + 1.month
      ).and_return(Success())

      result = operation.send(:recreate_future_transactions, transaction: transaction)
      expect(result).to be_success
    end
  end

  describe 'Integration Tests' do
    let(:changed_transaction) do
      transaction.amount = Money.from_amount(200, "PHP")
      transaction
    end
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
             repeat_count: 3,
             parent_id: transaction.id,
             effective_parent_id: transaction.id,
             balance_state: "pending")
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
             repeat_count: 3,
             parent_id: transaction.id,
             effective_parent_id: transaction.id,
             balance_state: "calculated")
    end

    before do
      allow(changed_transaction).to receive(:series_records).and_return(
        Transactions::Transaction.where(id: [transaction.id, future_transaction1.id, future_transaction2.id])
      )

      allow(changed_transaction).to receive(:root_parent).and_return(transaction)

      create_repeat_operation = instance_double(Transactions::Operations::CreateRepeatTransactions)
      allow(Transactions::Operations::CreateRepeatTransactions).to receive(:new).and_return(create_repeat_operation)
      allow(create_repeat_operation).to receive(:call).and_return(Success())

      delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
      allow(delete_operation).to receive(:call).and_return(Success())
    end

    context 'with real transaction updates' do
      it 'processes all steps correctly' do
        result = operation.call({ transaction: changed_transaction })
        expect(result).to be_success
        expect(result.value!).to eq(changed_transaction)
      end
    end

    context 'with all_in_series flag' do
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
               repeat_count: 3,
               parent_id: transaction.id,
               effective_parent_id: transaction.id,
               balance_state: "calculated")
      end

      before do
        allow(changed_transaction).to receive(:series_records).and_return(
          Transactions::Transaction.where(id: [transaction.id, future_transaction1.id, future_transaction2.id, past_transaction.id])
        )
      end

      it 'includes past transactions in the update process' do
        result = operation.call({ transaction: changed_transaction, all_in_series: true })
        expect(result).to be_success
        expect(result.value!).to eq(changed_transaction)
      end
    end
  end
end
