# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::DeleteTransaction do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:category) { create(:category, space:, category_type: "expense", name: "Groceries") }
  let(:transaction) do
    create(:expense_transaction,
           user:,
           space:,
           account:,
           category:,
           amount: Money.from_amount(100, "PHP"),
           date: Time.zone.today)
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when id is missing' do
        result = operation.validate(params: { id: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end
    end

    context 'with invalid delete_scope' do
      it 'fails when delete_scope is not one of the valid options' do
        result = operation.validate(params: {
          id: transaction.id,
          delete_scope: "invalid_scope"
        })
        expect(result).to be_failure
        expect(result.failure[:delete_scope]).to include("must be one of: this_only, this_and_future, all_in_series")
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation with id only' do
        result = operation.validate(params: { id: transaction.id })
        expect(result).to be_success
      end

      it 'succeeds validation with valid delete_scope' do
        result = operation.validate(params: {
          id: transaction.id,
          delete_scope: "this_only"
        })
        expect(result).to be_success
      end

      it 'succeeds validation with this_and_future scope' do
        result = operation.validate(params: {
          id: transaction.id,
          delete_scope: "this_and_future"
        })
        expect(result).to be_success
      end

      it 'succeeds validation with all_in_series scope' do
        result = operation.validate(params: {
          id: transaction.id,
          delete_scope: "all_in_series"
        })
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    let(:delete_this_operation) { instance_double(Transactions::Operations::DeleteThisTransaction) }
    let(:delete_this_and_future_operation) { instance_double(Transactions::Operations::DeleteThisAndFutureTransactions) }
    let(:delete_all_in_series_operation) { instance_double(Transactions::Operations::DeleteAllInSeriesTransactions) }

    before do
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_this_operation)
      allow(Transactions::Operations::DeleteThisAndFutureTransactions).to receive(:new).and_return(delete_this_and_future_operation)
      allow(Transactions::Operations::DeleteAllInSeriesTransactions).to receive(:new).and_return(delete_all_in_series_operation)
      allow(delete_this_operation).to receive(:call).and_return(Success(transaction))
      allow(delete_this_and_future_operation).to receive(:call).and_return(Success(transaction))
      allow(delete_all_in_series_operation).to receive(:call).and_return(Success(transaction))
    end

    context 'when validation fails' do
      it 'returns validation failure for missing id' do
        result = operation.call({ id: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end

      it 'returns validation failure for invalid delete_scope' do
        result = operation.call({
          id: transaction.id,
          delete_scope: "invalid_scope"
        })
        expect(result).to be_failure
        expect(result.failure[:delete_scope]).to include("must be one of: this_only, this_and_future, all_in_series")
      end
    end

    context 'when transaction is not found' do
      it 'returns not found error' do
        result = operation.call({ id: "non-existent-id" })
        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end
    end

    context 'with valid parameters' do
      let(:update_summary_operation) { instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary) }

      before do
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Success())
      end

      it 'returns the transaction when successful' do
        result = operation.call({ id: transaction.id })
        expect(result).to be_success
        expect(result.value!).to eq(transaction)
      end

      it 'calls update_monthly_summary after successful deletion' do
        result = operation.call({ id: transaction.id })
        expect(result).to be_success

        expect(update_summary_operation).to have_received(:call).with(
          space_id: transaction.space_id,
          transaction_date: transaction.date.to_date
        )
      end
    end

    context 'with delete_scope: this_only' do
      it 'calls DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.call({
          id: transaction.id,
          delete_scope: "this_only"
        })
        expect(result).to be_success
      end
    end

    context 'with delete_scope: this_and_future' do
      it 'calls DeleteThisAndFutureTransactions operation' do
        expect(delete_this_and_future_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.call({
          id: transaction.id,
          delete_scope: "this_and_future"
        })
        expect(result).to be_success
      end
    end

    context 'with delete_scope: all_in_series' do
      it 'calls DeleteAllInSeriesTransactions operation' do
        expect(delete_all_in_series_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.call({
          id: transaction.id,
          delete_scope: "all_in_series"
        })
        expect(result).to be_success
      end
    end

    context 'with delete_scope: all_in_series across multiple months' do
      let(:parent_transaction) do
        create(
          :expense_transaction,
          user:,
          space:,
          account:,
          category:,
          date: transaction.date
        )
      end

      let(:other_month_transaction) do
        create(
          :expense_transaction,
          user:,
          space:,
          account:,
          category:,
          date: Time.zone.today + 1.month,
          parent: parent_transaction
        )
      end

      before do
        # Make transaction part of the series by setting its parent
        transaction.update!(parent: parent_transaction)
        # Ensure other_month_transaction is created before the test runs
        other_month_transaction
      end

      it 'recalculates monthly summaries for all affected months' do
        update_summary_operation = instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary)
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Success())

        result = operation.call({
          id: transaction.id,
          delete_scope: "all_in_series"
        })

        expect(result).to be_success

        expect(update_summary_operation).to have_received(:call).with(
          space_id: transaction.space_id,
          transaction_date: transaction.date.to_date
        )
        expect(update_summary_operation).to have_received(:call).with(
          space_id: transaction.space_id,
          transaction_date: other_month_transaction.date.to_date
        )
      end
    end

    context 'when delete_scope is not specified' do
      it 'defaults to calling DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.call({ id: transaction.id })
        expect(result).to be_success
      end
    end

    context 'when delete_scope is empty string' do
      it 'defaults to calling DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.call({
          id: transaction.id,
          delete_scope: ""
        })
        expect(result).to be_success
      end
    end

    context 'when delegated operation fails' do
      it 'propagates failure from DeleteThisTransaction' do
        allow(delete_this_operation).to receive(:call).and_return(Failure(error: "delete failed"))

        result = operation.call({
          id: transaction.id,
          delete_scope: "this_only"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end

      it 'propagates failure from DeleteThisAndFutureTransactions' do
        allow(delete_this_and_future_operation).to receive(:call).and_return(Failure(error: "delete failed"))

        result = operation.call({
          id: transaction.id,
          delete_scope: "this_and_future"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end

      it 'propagates failure from DeleteAllInSeriesTransactions' do
        allow(delete_all_in_series_operation).to receive(:call).and_return(Failure(error: "delete failed"))

        result = operation.call({
          id: transaction.id,
          delete_scope: "all_in_series"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end
  end

  describe '#find_transaction' do
    it 'returns the transaction when found' do
      result = operation.send(:find_transaction, params: { id: transaction.id })
      expect(result).to be_success
      expect(result.value!).to eq(transaction)
    end

    it 'returns failure when transaction is not found' do
      result = operation.send(:find_transaction, params: { id: "non-existent-id" })
      expect(result).to be_failure
      expect(result.failure).to include(:id)
    end
  end

  describe '#determine_action' do
    let(:delete_this_operation) { instance_double(Transactions::Operations::DeleteThisTransaction) }
    let(:delete_this_and_future_operation) { instance_double(Transactions::Operations::DeleteThisAndFutureTransactions) }
    let(:delete_all_in_series_operation) { instance_double(Transactions::Operations::DeleteAllInSeriesTransactions) }

    before do
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_this_operation)
      allow(Transactions::Operations::DeleteThisAndFutureTransactions).to receive(:new).and_return(delete_this_and_future_operation)
      allow(Transactions::Operations::DeleteAllInSeriesTransactions).to receive(:new).and_return(delete_all_in_series_operation)
      allow(delete_this_operation).to receive(:call).and_return(Success(transaction))
      allow(delete_this_and_future_operation).to receive(:call).and_return(Success(transaction))
      allow(delete_all_in_series_operation).to receive(:call).and_return(Success(transaction))
    end

    context 'when delete_scope is this_only' do
      it 'calls DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: { delete_scope: "this_only" },
                               transaction: transaction)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is this_and_future' do
      it 'calls DeleteThisAndFutureTransactions operation' do
        expect(delete_this_and_future_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: { delete_scope: "this_and_future" },
                               transaction: transaction)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is all_in_series' do
      it 'calls DeleteAllInSeriesTransactions operation' do
        expect(delete_all_in_series_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: { delete_scope: "all_in_series" },
                               transaction: transaction)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is not specified' do
      it 'defaults to calling DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: {},
                               transaction: transaction)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is empty string' do
      it 'defaults to calling DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: { delete_scope: "" },
                               transaction: transaction)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is some other value' do
      it 'defaults to calling DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: { delete_scope: "some_other_value" },
                               transaction: transaction)
        expect(result).to be_success
      end
    end
  end

  describe 'monthly summary after create then delete' do
    let(:income_category) { create(:category, space:, category_type: "income", name: "Salary") }

    def create_entry(amount:, transaction_type:)
      Transactions::Operations::CreateTransaction.new.call(
        user_id: user.id,
        space_id: space.id,
        amount:,
        date: Date.current,
        description: "#{transaction_type} #{amount}",
        transaction_type:,
        category_name: transaction_type == "income" ? income_category.name : category.name,
        account_name: account.name,
        schedule_type: "one_time"
      ).value!
    end

    def delete_entry(entry)
      operation.call(
        id: entry.id,
        delete_scope: "this_only"
      )
    end

    def current_month_totals
      summary = MonthlyFinancialSummary.find_by!(
        space:,
        year: Date.current.year,
        month: Date.current.month
      )

      {
        total_income: summary.total_income.to_d,
        total_expenses: summary.total_expenses.to_d,
        net_savings: summary.net_savings.to_d
      }
    end

    it 'returns to zero after deleting the only negative expense' do
      entry = create_entry(amount: -40, transaction_type: "expense")
      expect(current_month_totals[:total_expenses]).to eq(-40)

      expect(delete_entry(entry)).to be_success

      expect(current_month_totals).to eq(
        total_income: 0,
        total_expenses: 0,
        net_savings: 0
      )
    end

    it 'returns to zero after deleting the only negative income' do
      entry = create_entry(amount: -40, transaction_type: "income")
      expect(current_month_totals[:total_income]).to eq(-40)

      expect(delete_entry(entry)).to be_success

      expect(current_month_totals).to eq(
        total_income: 0,
        total_expenses: 0,
        net_savings: 0
      )
    end

    it 'returns to zero after deleting the only positive expense' do
      entry = create_entry(amount: 40, transaction_type: "expense")

      expect(delete_entry(entry)).to be_success

      expect(current_month_totals).to eq(
        total_income: 0,
        total_expenses: 0,
        net_savings: 0
      )
    end

    it 'keeps other transactions intact when a negative expense is deleted' do
      create_entry(amount: 500, transaction_type: "income")
      create_entry(amount: 100, transaction_type: "expense")
      entry = create_entry(amount: -40, transaction_type: "expense")
      expect(current_month_totals).to eq(
        total_income: 500,
        total_expenses: 60,
        net_savings: 440
      )

      expect(delete_entry(entry)).to be_success

      expect(current_month_totals).to eq(
        total_income: 500,
        total_expenses: 100,
        net_savings: 400
      )
    end
  end
end
