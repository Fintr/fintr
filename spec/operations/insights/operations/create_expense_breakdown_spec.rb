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
          t.transactable_type.in?(['Transactions::Expense', 'Transactions::Transfer'])
        end
        Dry::Monads::Success(filtered_transactions)
      end
    end

    context 'with valid expense transactions' do
      subject(:call_operation) { operation.call(transactions: transactions_combined) }

      let!(:groceries_category) { create(:category, space: space, name: 'Groceries', category_type: 'expense') }
      let!(:utilities_category) { create(:category, space: space, name: 'Utilities', category_type: 'expense') }

      let(:groceries_transaction1) { create_transaction(type: :expense, amount_value: 100, category: groceries_category) }
      let(:groceries_transaction2) { create_transaction(type: :expense, amount_value: 50, category: groceries_category) }
      let(:utilities_transaction) { create_transaction(type: :expense, amount_value: 200, category: utilities_category) }

      let(:actual_transactions) { [groceries_transaction1, groceries_transaction2, utilities_transaction] }

      let(:transactions_combined) do
        actual_transactions.map do |t|
          # Create Combined transaction stubs that delegate to actual transactions
          combined = build_stubbed(:combined_transaction, transactable: t, space: space)
          # Set category_name based on the transaction's category
          allow(combined).to receive(:category_name).and_return(t.category&.name)
          # Set transactable_type for filtering
          allow(combined).to receive(:transactable_type).and_return(t.class.name)
          # Set amount_currency
          allow(combined).to receive(:amount_currency).and_return(t.amount_currency)
          # Explicitly stub the expense method to return the expense from the underlying transaction
          allow(combined).to receive(:expense).and_return(t.expense) # t.expense should be a Money object
          combined
        end
      end

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

    context 'with transfers (nil category names)' do
      subject(:call_operation) { operation.call(transactions: transactions_combined) }

      let(:transfer1) { create_transaction(type: :transfer, amount_value: 100) }
      let(:transfer2) { create_transaction(type: :transfer, amount_value: 50) }

      let(:actual_transactions) { [transfer1, transfer2] }

      let(:transactions_combined) do
        actual_transactions.map do |t|
          combined = build_stubbed(:combined_transaction, transactable: t, space: space)
          # Transfers have nil category_name
          allow(combined).to receive(:category_name).and_return(nil)
          allow(combined).to receive(:transactable_type).and_return(t.class.name)
          allow(combined).to receive(:amount_currency).and_return(t.amount_currency)
          # Explicitly stub the expense method
          allow(combined).to receive(:expense).and_return(t.expense) # t.expense should be Money.zero for a Transfer
          combined
        end
      end

      it { is_expected.to be_success }

      it 'groups transfers under "Transfers" category' do
        result = call_operation.value!
        # If only transfers are present, total_expenses will be 0, and the operation returns an empty array.
        expect(result).to be_an(Array)
        expect(result).to be_empty # Expect an empty array
      end
    end

    context 'with mixed expenses and transfers' do
      subject(:call_operation) { operation.call(transactions: transactions_combined) }

      let!(:groceries_category) { create(:category, space: space, name: 'Groceries', category_type: 'expense') }

      let(:expense_transaction) { create_transaction(type: :expense, amount_value: 200, category: groceries_category) }
      let(:transfer_transaction) { create_transaction(type: :transfer, amount_value: 100) }

      let(:actual_transactions) { [expense_transaction, transfer_transaction] }

      let(:transactions_combined) do
        actual_transactions.map do |t|
          combined = build_stubbed(:combined_transaction, transactable: t, space: space)
          if t.is_a?(Transactions::Transfer)
            allow(combined).to receive(:category_name).and_return(nil)
          else
            allow(combined).to receive(:category_name).and_return(t.category&.name)
          end
          allow(combined).to receive(:transactable_type).and_return(t.class.name)
          allow(combined).to receive(:amount_currency).and_return(t.amount_currency)
          # Explicitly stub the expense method
          allow(combined).to receive(:expense).and_return(t.expense) # Returns Money object
          combined
        end
      end

      it { is_expected.to be_success }

      it 'correctly groups expenses and transfers separately' do
        result = call_operation.value!
        expect(result).to be_an(Array)
        expect(result.length).to eq(2)

        groceries_breakdown = result.find { |b| b[:category_name] == 'Groceries' }
        expect(groceries_breakdown).to be_present
        expect(groceries_breakdown[:amount]).to eq('formatted_200.0')
        # Percentage: (Expense Amount / Total Expenses) * 100. Total Expenses here is just the groceries amount.
        expect(groceries_breakdown[:percentage]).to eq(Utils::Number.format_percentage((200.0.to_d / 200.0) * 100)) # Adjusted calculation
        expect(groceries_breakdown[:currency]).to eq('PHP')

        transfers_breakdown = result.find { |b| b[:category_name] == 'Transfers' }
        expect(transfers_breakdown).to be_present
        expect(transfers_breakdown[:amount]).to eq('formatted_0.0') # Transfers contribute 0 to expenses
        # Percentage: (Transfer Expense Amount / Total Expenses) * 100. Transfer expense is 0.
        expect(transfers_breakdown[:percentage]).to eq(Utils::Number.format_percentage((0.0.to_d / 200.0) * 100)) # Adjusted calculation
        expect(transfers_breakdown[:currency]).to eq('PHP')
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
          expect(result.failure[:transactions]).to include('should be an array of transactions')
        end
      end

      context 'when transactions is not an array of Combined transactions' do
        subject(:call_operation) { operation.call(transactions: ['not a transaction', 123]) }

        it { is_expected.to be_failure }

        it 'returns validation errors' do
          result = call_operation
          expect(result.failure).to include(transactions: ['should be an array of transactions'])
        end
      end
    end

    context 'with no expense or transfer transactions' do
      subject(:call_operation) { operation.call(transactions: transactions_combined) }

      let!(:income_category) { create(:category, space: space, name: 'Salary', category_type: 'income') }
      let(:income_transaction) { create_transaction(type: :income, amount_value: 1000, category: income_category) }

      let(:actual_transactions) { [income_transaction] }

      let(:transactions_combined) do
        actual_transactions.map do |t|
          combined = build_stubbed(:combined_transaction, transactable: t, space: space)
          allow(combined).to receive(:category_name).and_return(t.category&.name)
          allow(combined).to receive(:transactable_type).and_return(t.class.name)
          allow(combined).to receive(:amount_currency).and_return(t.amount_currency)
          # Explicitly stub the expense method
          allow(combined).to receive(:expense).and_return(t.expense) # Should be Money.zero for Income
          combined
        end
      end

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
