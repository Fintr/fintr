# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Insights::Operations::CreateExpenseBreakdown do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space: space) }

  describe '#call' do
    context 'with valid transactions' do
      subject(:call_operation) { operation.call(transactions: transactions) }

      let!(:groceries_category) { create(:category, space: space, name: 'Groceries', category_type: 'expense') }
      let!(:utilities_category) { create(:category, space: space, name: 'Utilities', category_type: 'expense') }
      let!(:groceries_transactions) do
        [
          create(:expense_transaction, space: space, account: account, category: groceries_category, amount: Money.from_amount(100, 'PHP')),
          create(:expense_transaction, space: space, account: account, category: groceries_category, amount: Money.from_amount(50, 'PHP'))
        ]
      end
      let!(:utilities_transactions) do
        [
          create(:expense_transaction, space: space, account: account, category: utilities_category, amount: Money.from_amount(200, 'PHP'))
        ]
      end

      let(:transactions) do
        Transactions::Transaction
          .select('transactions.*, transactions_categories.name as category_name')
          .joins(:category)
          .where(id: groceries_transactions + utilities_transactions)
      end


      it { is_expected.to be_success }

      it 'returns the correct expense breakdown' do
        result = call_operation.value!
        expect(result).to be_an(Array)
        expect(result.length).to eq(2)

        # Find the groceries breakdown
        groceries_breakdown = result.find { |b| b[:category_name] == 'Groceries' }
        expect(groceries_breakdown).to be_present
        expect(groceries_breakdown[:amount]).to eq(Utils::Number.format_number(150))
        expect(groceries_breakdown[:percentage]).to eq(Utils::Number.format_percentage((150.0 / 350.0) * 100))
        expect(groceries_breakdown[:currency]).to eq('PHP')

        # Find the utilities breakdown
        utilities_breakdown = result.find { |b| b[:category_name] == 'Utilities' }
        expect(utilities_breakdown).to be_present
        expect(utilities_breakdown[:amount]).to eq(Utils::Number.format_number(200))
        expect(utilities_breakdown[:percentage]).to eq(Utils::Number.format_percentage((200.0 / 350.0) * 100))
        expect(utilities_breakdown[:currency]).to eq('PHP')
      end
    end

    context 'with invalid parameters' do
      context 'when transactions is missing' do
        subject(:call_operation) { operation.call(transactions: {}) }

        it { is_expected.to be_failure }

        it 'returns validation errors' do
          result = call_operation
          expect(result.failure).to include(:transactions)
        end
      end

      context 'when transactions is not an array of transactions' do
        subject(:call_operation) { operation.call(params: { transactions: ['not a transaction'] }) }

        it { is_expected.to be_failure }

        it 'returns validation errors' do
          result = call_operation
          expect(result.failure).to include(:transactions)
        end
      end
    end

    context 'with no expense transactions' do
      subject(:call_operation) { operation.call(transactions:) }

      let!(:income_category) { create(:category, space: space, name: 'Salary', category_type: 'income') }
      let!(:income_transactions) do
        [
          create(:income_transaction, space: space, account: account, category: income_category, amount: Money.from_amount(1000, 'PHP'))
        ]
      end

      let(:transactions) { Transactions::Transaction.where(id: income_transactions) }


      it { is_expected.to be_success }

      it 'returns an empty array' do
        result = call_operation.value!
        expect(result).to be_an(Array)
        expect(result).to be_empty
      end
    end
  end
end
