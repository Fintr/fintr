# frozen_string_literal: true

require 'rails_helper'
require 'dry/monads'

RSpec.describe Insights::Operations::CreateSummaryStructure do
  include Dry::Monads[:result, :do]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) } # Changed to users: [user]
  let!(:account) { create(:account, space: space) } # Removed explicit financial_institution

  # Helper to create transactions
  def create_transaction(type:, amount_value:, currency: 'PHP')
    category_type = (type == :income) ? 'income' : 'expense'
    category_name = (type == :income) ? 'Salary' : 'Groceries'
    # Use find_or_create_by to avoid RecordInvalid for categories, with correct namespace
    category = Transactions::Category.find_or_create_by!(space: space, name: category_name, category_type: category_type)

    transaction_factory_name = "#{type}_transaction".to_sym

    transaction = create(
      transaction_factory_name,
      space: space,
      account: account,
      category: category,
      amount: Money.from_amount(amount_value, currency),
      date: Time.zone.today
    )
    transaction
  end

  def selected_transactions(transaction_ids)
    Transactions::Transaction
      .joins(:category)
      .select('
        transactions.*,
        transactions.type as transaction_type,
        transactions_categories.name as category_name
      ')
      .where(id: transaction_ids)
  end

  describe '#call' do
    before do
      # Mock Utils::Number.format_number to simplify assertions and verify calls
      allow(Utils::Number).to receive(:format_number) { |num| "formatted_#{num}" } # Corrected syntax
    end

    context 'with valid transactions' do
      subject(:call_operation) { operation.call(transactions: transactions) }

      let(:income_transaction1) { create_transaction(type: :income, amount_value: 1000) }
      let(:income_transaction2) { create_transaction(type: :income, amount_value: 500) }
      let(:expense_transaction1) { create_transaction(type: :expense, amount_value: 200) }
      let(:expense_transaction2) { create_transaction(type: :expense, amount_value: 100) }
      let(:transaction_ids) { [income_transaction1, income_transaction2, expense_transaction1, expense_transaction2].pluck(:id) }
      let(:transactions) { selected_transactions(transaction_ids) }

      it { is_expected.to be_success }

      it 'returns the correct summary structure' do
        result = call_operation.value!
        expect(result[:total_income]).to eq('formatted_1500.0')
        expect(result[:total_expenses]).to eq('formatted_300.0')
        expect(result[:net_savings]).to eq('formatted_1200.0')
      end

      it 'calls Utils::Number.format_number for each component' do
        call_operation.value! # Execute the operation
        expect(Utils::Number).to have_received(:format_number).with(1500).once
        expect(Utils::Number).to have_received(:format_number).with(300).once
        expect(Utils::Number).to have_received(:format_number).with(1200).once
      end
    end

    context 'with only income transactions' do
      subject(:call_operation) { operation.call(transactions: transactions) }

      let(:income_transaction1) { create_transaction(type: :income, amount_value: 700) }
      let(:transaction_ids) { [income_transaction1.id] }
      let(:transactions) { selected_transactions(transaction_ids) }

      it { is_expected.to be_success }

      it 'returns correct summary with zero expenses' do
        result = call_operation.value!
        expect(result[:total_income]).to eq('formatted_700.0')
        expect(result[:total_expenses]).to eq('formatted_0')
        expect(result[:net_savings]).to eq('formatted_700.0')
      end
    end

    context 'with only expense transactions' do
      subject(:call_operation) { operation.call(transactions: transactions) }

      let(:expense_transaction1) { create_transaction(type: :expense, amount_value: 400) }
      let(:transaction_ids) { [expense_transaction1.id] }
      let(:transactions) { selected_transactions(transaction_ids) }

      it { is_expected.to be_success }

      it 'returns correct summary with zero income' do
        result = call_operation.value!
        expect(result[:total_income]).to eq('formatted_0')
        expect(result[:total_expenses]).to eq('formatted_400.0')
        expect(result[:net_savings]).to eq('formatted_-400.0') # Net savings can be negative
      end
    end

    context 'with transactions having zero amounts' do
      subject(:call_operation) { operation.call(transactions: transactions) }

      let(:income_zero) { create_transaction(type: :income, amount_value: 0) }
      let(:expense_zero) { create_transaction(type: :expense, amount_value: 0) }
      let(:transaction_ids) { [income_zero.id, expense_zero.id] }
      let(:transactions) { selected_transactions(transaction_ids) }

      it { is_expected.to be_success }

      it 'returns all zeros correctly formatted' do
        result = call_operation.value!
        expect(result[:total_income]).to eq('formatted_0.0')
        expect(result[:total_expenses]).to eq('formatted_0.0')
        expect(result[:net_savings]).to eq('formatted_0.0')
      end
    end

    describe 'Contract Validations' do
      context 'when transactions parameter is missing' do
        # The operation's call method expects `params` to be a hash (e.g. {transactions: ...}).
        # If `call` receives an empty hash `{}`, its `validate(params: {})` is called.
        # Then `Contract.new.call(**{})` inside validate raises an ArgumentError.
        it 'raises ArgumentError when contract is called with no effective arguments' do
          expect { operation.call({}) }.to raise_error(ArgumentError, "wrong number of arguments (given 0, expected 1..2)")
        end

        # To specifically test the contract's :transactions missing error, we would need to call
        # the operation in a way that params has other keys but not :transactions, e.g.,
        # operation.call(some_other_key: "value") if the operation could accept that.
        # However, this operation is simple and only takes :transactions via its params hash.
        # The most direct test for the contract itself would be:
        # it 'contract fails if transactions key is missing' do
        #   contract_result = described_class::Contract.new.call({})
        #   expect(contract_result.failure?).to be true
        #   expect(contract_result.errors.to_h).to include(transactions: ['is missing'])
        # end
        # But we are testing the operation call.
      end

      context 'when transactions is an empty array' do
        subject(:call_operation) { operation.call(transactions: []) }

        it { is_expected.to be_failure }

        it 'returns transactions type error due to .first on empty array' do
          failure = call_operation.failure
          expect(failure).to include(:transactions)
          # The contract rule is `values[:transactions].first.is_a?(Transactions::Transaction)`
          # If `values[:transactions]` is empty, `.first` is nil.
          # `nil.is_a?(...)` is false, so the rule `key.failure(...)` should be triggered.
          expect(failure[:transactions]).to include('should be an array of transactions')
        end
      end

      context 'when transactions is an array of non-Transaction objects' do
        subject(:call_operation) { operation.call(transactions: ['not a transaction', 123]) }

        it { is_expected.to be_failure }

        it 'returns transactions type error' do
          expect(call_operation.failure).to include(transactions: ['should be an array of transactions'])
        end
      end
    end
  end
end
