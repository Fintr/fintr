# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Insights::Operations::CreateWeeklySpending do
  let(:operation) { described_class.new }

  describe '#call' do
    before do
      # Mock Utils::Number methods for consistent testing
      allow(Utils::Number).to receive(:format_number) { |num| num.round(2) }
      allow(Utils::Number).to receive(:format_percentage) { |num| "#{num.round(2)}%" }
    end

    context 'with valid expense transactions' do
      subject(:call_operation) { operation.call(transactions:) }

      let(:transactions) { build_stubbed_list(:expense_transaction, 2) }

      before do
        # Mock the get_expenses method to return a proper ActiveRecord-like relation
        mock_relation = instance_double(ActiveRecord::Relation)
        allow(mock_relation).to receive(:blank?).and_return(false)
        allow(mock_relation).to receive(:sum).and_return(Money.from_amount(100.0, 'PHP'))
        allow(mock_relation).to receive(:order).with(date: :asc).and_return([
          instance_double(
            Transactions::Expense,
            date: Date.current,
            expense: Money.from_amount(100.0, 'PHP'),
            amount_currency: 'PHP'
          )
        ])

        allow(operation).to receive(:get_expenses).and_return(Dry::Monads::Success(mock_relation))
      end

      it { is_expected.to be_success }

      it 'returns weekly spending data' do
        result = call_operation.value!
        expect(result).to be_an(Array)
        expect(result.first).to include(:date, :amount, :percentage, :currency)
      end
    end

    context 'with empty expenses' do
      subject(:call_operation) { operation.call(transactions:) }

      let(:transactions) { [build_stubbed(:income_transaction)] }

      before do
        # Mock get_expenses to return empty relation
        mock_relation = instance_double(ActiveRecord::Relation)
        allow(mock_relation).to receive(:blank?).and_return(true)
        allow(mock_relation).to receive(:sum).and_return(Money.from_amount(0.0, 'PHP'))

        allow(operation).to receive(:get_expenses).and_return(Dry::Monads::Success(mock_relation))
      end

      it { is_expected.to be_success }

      it 'returns empty array' do
        result = call_operation.value!
        expect(result).to eq([])
      end
    end

    context 'with zero total expenses' do
      subject(:call_operation) { operation.call(transactions:) }

      let(:transactions) { Transactions::Transaction.where.not(id: nil) } # 0 results

      before do
        # Mock get_expenses to return relation with zero sum
        mock_relation = instance_double(ActiveRecord::Relation)
        allow(mock_relation).to receive(:blank?).and_return(false)
        allow(mock_relation).to receive(:sum).and_return(Money.from_amount(0.0, 'PHP'))

        allow(operation).to receive(:get_expenses).and_return(Dry::Monads::Success(mock_relation))
      end

      it { is_expected.to be_success }

      it 'returns empty array when total expenses is zero' do
        result = call_operation.value!
        expect(result).to eq([])
      end
    end

    describe 'Contract Validations' do
      context 'when transactions parameter is missing' do
        it 'raises ArgumentError when contract is called with no effective arguments' do
          expect { operation.call({}) }.to raise_error(ArgumentError, "wrong number of arguments (given 0, expected 1..2)")
        end
      end

      context 'when transactions parameter is not an array of expense transactions' do
        let(:invalid_transactions) { ['not a transaction'] }

        it 'returns failure with validation error' do
          result = operation.call(transactions: invalid_transactions)
          expect(result).to be_failure
          expect(result.failure).to include(:transactions)
          expect(result.failure[:transactions]).to include('should be a relation of transactions')
        end
      end
    end

    describe 'Edge Cases' do
      context 'with multiple transactions on same date' do
        subject(:call_operation) { operation.call(transactions:) }

        let(:transactions) { build_stubbed_list(:expense_transaction, 2) }

        before do
          # Mock get_expenses to return relation with multiple transactions on same date
          same_date = Date.current
          mock_relation = instance_double(ActiveRecord::Relation)
          allow(mock_relation).to receive(:blank?).and_return(false)
          allow(mock_relation).to receive(:sum).and_return(Money.from_amount(150.0, 'PHP'))
          allow(mock_relation).to receive(:order).with(date: :asc).and_return([
            instance_double(Transactions::Combined, date: same_date, expense: Money.from_amount(100.0, 'PHP'), amount_currency: 'PHP'),
            instance_double(Transactions::Combined, date: same_date, expense: Money.from_amount(50.0, 'PHP'), amount_currency: 'PHP')
          ])

          allow(operation).to receive(:get_expenses).and_return(Dry::Monads::Success(mock_relation))
        end

        it { is_expected.to be_success }

        it 'groups transactions by date correctly' do
          result = call_operation.value!
          expect(result).to be_an(Array)
          expect(result.length).to eq(7) # Should show all 7 days

          # Find the day that has transactions (current date)
          day_with_transactions = result.find { |day| day[:amount] != 0.0 }
          expect(day_with_transactions[:amount]).to eq(150.0) # Sum of both transactions

          # Check that days without transactions show 0
          days_without_transactions = result.reject { |day| day[:amount] != 0.0 }
          expect(days_without_transactions.length).to eq(6) # 6 days with no transactions
          days_without_transactions.each do |day|
            expect(day[:amount]).to eq(0.0)
          end
        end
      end

      context 'with different currencies' do
        subject(:call_operation) { operation.call(transactions:) }

        let(:transactions) { build_stubbed_list(:expense_transaction, 2) }

        before do
          # Mock get_expenses to return transactions with different currencies
          mock_relation = instance_double(ActiveRecord::Relation)
          allow(mock_relation).to receive(:blank?).and_return(false)
          allow(mock_relation).to receive(:sum).and_return(Money.from_amount(150.0, 'PHP'))
          allow(mock_relation).to receive(:order).with(date: :asc).and_return([
            instance_double(Transactions::Combined, date: Date.current, expense: Money.from_amount(100.0, 'PHP'), amount_currency: 'PHP'),
            instance_double(Transactions::Combined, date: 1.day.ago.to_date, expense: Money.from_amount(50.0, 'USD'), amount_currency: 'USD')
          ])

          allow(operation).to receive(:get_expenses).and_return(Dry::Monads::Success(mock_relation))
        end

        it { is_expected.to be_success }

        it 'handles different currencies correctly' do
          result = call_operation.value!
          expect(result).to be_an(Array)
          expect(result.length).to eq(7) # Should show all 7 days

          # Find days with transactions
          days_with_transactions = result.reject { |day| day[:amount] == 0.0 }
          expect(days_with_transactions.length).to eq(2) # 2 days with transactions

          # Check that both currencies are present
          currencies = days_with_transactions.map { |item| item[:currency] }
          expect(currencies).to include('PHP', 'USD')

          # Check that days without transactions show 0
          days_without_transactions = result.select { |day| day[:amount] == 0.0 }
          expect(days_without_transactions.length).to eq(5) # 5 days with no transactions
        end
      end
    end
  end
end
