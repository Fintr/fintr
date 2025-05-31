# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Insights::Operations::CreateExpenseBreakdown do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space: space) }

  # Helper to create transactions
  def create_transaction(type:, amount_value:, category: nil, currency: 'PHP')
    if type == :transfer
      # For transfers, we don't use a category
      transaction = create(
        :transfer,
        space: space,
        from_account: account,
        to_account: create(:account, space: space),
        amount: Money.from_amount(amount_value, currency),
        date: Time.zone.today
      )
    else
      category_type = (type == :income) ? 'income' : 'expense'
      category_name = category&.name || ((type == :income) ? 'Salary' : 'Groceries')

      # Use provided category or find/create one
      used_category = category || Transactions::Category.find_or_create_by!(
        space: space,
        name: category_name,
        category_type: category_type
      )

      transaction_factory_name = "#{type}_transaction".to_sym
      transaction = create(
        transaction_factory_name,
        space: space,
        account: account,
        category: used_category,
        amount: Money.from_amount(amount_value, currency),
        date: Time.zone.today
      )
    end
    transaction
  end

  describe '#call' do
    before do
      # Mock Utils::Number methods for consistent testing
      allow(Utils::Number).to receive(:format_number) { |num| "formatted_#{num}" }
      allow(Utils::Number).to receive(:format_percentage) { |num| "#{num}%" }

      # Mock the get_expenses step to return the combined transactions directly
      # filtered as the operation intends.
      allow(operation).to receive(:get_expenses) do |args|
        params = args[:params]
        filtered_transactions = params[:transactions].select do |t|
          t.type.in?(['Transactions::Expense'])
        end
        Dry::Monads::Success(filtered_transactions)
      end
    end

    context 'with valid expense transactions' do
      subject(:call_operation) { operation.call(transactions:) }

      let!(:groceries_category) { create(:category, space: space, name: 'Groceries', category_type: 'expense') }
      let!(:utilities_category) { create(:category, space: space, name: 'Utilities', category_type: 'expense') }

      let(:groceries_transaction1) { create_transaction(type: :expense, amount_value: 100, category: groceries_category) }
      let(:groceries_transaction2) { create_transaction(type: :expense, amount_value: 50, category: groceries_category) }
      let(:utilities_transaction) { create_transaction(type: :expense, amount_value: 200, category: utilities_category) }

      let(:transactions) { [groceries_transaction1, groceries_transaction2, utilities_transaction] }

      it { is_expected.to be_success }

      it 'returns the correct expense breakdown' do
        result = call_operation.value!
        expect(result).to be_an(Array)
        expect(result.length).to eq(2)

        # Find the groceries breakdown
        groceries_breakdown = result.find { |b| b[:category_name] == 'Groceries' }
        expect(groceries_breakdown).to be_present
        expect(groceries_breakdown[:amount]).to eq('formatted_150.0')
        expect(groceries_breakdown[:percentage]).to eq(Utils::Number.format_percentage((150.0.to_d / 350.0) * 100))
        expect(groceries_breakdown[:currency]).to eq('PHP')

        # Find the utilities breakdown
        utilities_breakdown = result.find { |b| b[:category_name] == 'Utilities' }
        expect(utilities_breakdown).to be_present
        expect(utilities_breakdown[:amount]).to eq('formatted_200.0')
        expect(utilities_breakdown[:percentage]).to eq(Utils::Number.format_percentage((200.0.to_d / 350.0) * 100))
        expect(utilities_breakdown[:currency]).to eq('PHP')
      end
    end

    context 'with invalid parameters' do
      context 'when transactions parameter is missing' do
        it 'raises ArgumentError when contract is called with no effective arguments' do
          expect { operation.call({}) }.to raise_error(ArgumentError, "wrong number of arguments (given 0, expected 1..2)")
        end
      end

      context 'when transactions is an empty array' do
        subject(:call_operation) { operation.call(transactions: []) }

        it { is_expected.to be_failure }

        it 'returns validation errors' do
          result = call_operation
          expect(result.failure).to include(:transactions)
          expect(result.failure[:transactions]).to include('should be a relation of transactions')
        end
      end

      context 'when transactions is not an array of Combined transactions' do
        subject(:call_operation) { operation.call(transactions: ['not a transaction', 123]) }

        it { is_expected.to be_failure }

        it 'returns validation errors' do
          result = call_operation
          expect(result.failure).to include(transactions: ['should be a relation of transactions'])
        end
      end
    end

    context 'with no expense transactions' do
      subject(:call_operation) { operation.call(transactions:) }

      let!(:income_category) { create(:category, space: space, name: 'Salary', category_type: 'income') }
      let(:income_transaction) { create_transaction(type: :income, amount_value: 1000, category: income_category) }

      let(:transactions) { [income_transaction] }

      it { is_expected.to be_success }

      it 'returns an empty array' do
        result = call_operation.value!
        # If there are no expenses or transfers, get_expenses will return empty
        # create_expense_breakdown will receive an empty array and return an empty array
        expect(result).to be_an(Array)
        expect(result).to be_empty
      end
    end
  end
end
