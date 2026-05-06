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
      allow(Utils::Number).to receive(:format_number) { |num| "formatted_#{"%.1f" % num}" }

      # Stub methods on Money object that might be called by sum(&:income).amount
      # This is to ensure that our stubs behave correctly without hitting real Money methods if not intended.
      # We assume 'income' and 'expense' methods on transactables return a Money-like object.
      # And that 'amount' on that object gives the numeric value for sum.
      # However, if transactable.income directly returns a Money object, its .amount should work.
      # Let's ensure our actual transaction objects (income_transaction1, etc.) have .income and .expense returning Money.
      # The Transaction model likely has monetize :amount_cents, so .amount is a Money object.
      # income_transaction.income should return self.amount, expense_transaction.expense self.amount.
    end

    context 'with valid transactions' do
      subject(:call_operation) { operation.call(transactions: actual_transactions) }

      let(:income_transaction1) { create_transaction(type: :income, amount_value: 1000) }
      let(:income_transaction2) { create_transaction(type: :income, amount_value: 500) }
      let(:expense_transaction1) { create_transaction(type: :expense, amount_value: 200) }
      let(:expense_transaction2) { create_transaction(type: :expense, amount_value: 100) }
      let(:actual_transactions) { [income_transaction1, income_transaction2, expense_transaction1, expense_transaction2] }

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
      subject(:call_operation) { operation.call(transactions: actual_transactions) }

      let(:income_transaction1) { create_transaction(type: :income, amount_value: 700) }
      let(:actual_transactions) { [income_transaction1] }

      it { is_expected.to be_success }

      it 'returns correct summary with zero expenses' do
        result = call_operation.value!
        expect(result[:total_income]).to eq('formatted_700.0')
        expect(result[:total_expenses]).to eq('formatted_0.0')
        expect(result[:net_savings]).to eq('formatted_700.0')
      end
    end

    context 'with only expense transactions' do
      subject(:call_operation) { operation.call(transactions: actual_transactions) }

      let(:expense_transaction1) { create_transaction(type: :expense, amount_value: 400) }
      let(:actual_transactions) { [expense_transaction1] }

      it { is_expected.to be_success }

      it 'returns correct summary with zero income' do
        result = call_operation.value!
        expect(result[:total_income]).to eq('formatted_0.0')
        expect(result[:total_expenses]).to eq('formatted_400.0')
        expect(result[:net_savings]).to eq('formatted_-400.0') # Net savings can be negative
      end
    end

    context 'when transactions is an empty ActiveRecord::Relation' do
      subject(:call_operation) { operation.call(transactions: Transactions::Transaction.none) }

      it { is_expected.to be_success }

      it 'returns a summary with all zeros' do
        result = call_operation.value!
        expect(result[:total_income]).to eq('formatted_0.0')
        expect(result[:total_expenses]).to eq('formatted_0.0')
        expect(result[:net_savings]).to eq('formatted_0.0')
      end
    end

    context 'when transactions is nil' do
      subject(:call_operation) { operation.call(transactions: nil) }

      it { is_expected.to be_success }

      it 'returns a summary with all zeros' do
        result = call_operation.value!
        expect(result[:total_income]).to eq('formatted_0.0')
        expect(result[:total_expenses]).to eq('formatted_0.0')
        expect(result[:net_savings]).to eq('formatted_0.0')
      end
    end

    describe '#get_total_income' do
      context 'when transactions is blank' do
        it 'returns Success(0) for an empty array' do
          expect(operation.send(:get_total_income, params: { transactions: [] })).to eq(Success(0))
        end

        it 'returns Success(0) for nil' do
          expect(operation.send(:get_total_income, params: { transactions: nil })).to eq(Success(0))
        end

        it 'returns Success(0) for an empty ActiveRecord::Relation' do
          expect(operation.send(:get_total_income, params: { transactions: Transactions::Transaction.none })).to eq(Success(0))
        end
      end
    end

    describe '#get_total_expenses' do
      context 'when transactions is blank' do
        it 'returns Success(0) for an empty array' do
          expect(operation.send(:get_total_expenses, params: { transactions: [] })).to eq(Success(0))
        end

        it 'returns Success(0) for nil' do
          expect(operation.send(:get_total_expenses, params: { transactions: nil })).to eq(Success(0))
        end

        it 'returns Success(0) for an empty ActiveRecord::Relation' do
          expect(operation.send(:get_total_expenses, params: { transactions: Transactions::Transaction.none })).to eq(Success(0))
        end
      end
    end

    describe 'Contract Validations' do
      context 'when transactions parameter is missing' do
        it 'raises ArgumentError when contract is called with no effective arguments' do
          expect { operation.call({}) }.to raise_error(ArgumentError, "wrong number of arguments (given 0, expected 1..2)")
        end
      end

      context 'when transactions is an array of non-Combined objects' do
        subject(:call_operation) { operation.call(transactions: ['not a transaction', 123]) }

        it { is_expected.to be_failure }

        it 'returns transactions type error' do
          expect(call_operation.failure).to include(transactions: ['should be a relation of transactions'])
        end
      end
    end
  end
end
