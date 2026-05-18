# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Insights::Operations::CreateWeeklySpending do
  let(:operation) { described_class.new }
  let(:space) { instance_double(Spaces::Space, id: 1, currency: 'PHP') }

  describe '#call' do
    before do
      allow(Utils::Number).to receive(:format_number) { |num| num.round(2) }
      allow(Utils::Number).to receive(:format_percentage) { |num| "#{num.round(2)}%" }
      allow(Insights::SpaceCurrencyAmount).to receive(:to_space_decimal) do |money:, **|
        money.amount.to_d
      end
    end

    context 'with valid expense transactions' do
      subject(:call_operation) { operation.call(transactions:, space: space) }

      let(:transactions) { build_stubbed_list(:expense_transaction, 2) }

      before do
        stub_row = instance_double(
          Transactions::Expense,
          date: Date.current,
          expense: Money.from_amount(100.0, 'PHP')
        )
        mock_relation = instance_double(ActiveRecord::Relation)
        allow(mock_relation).to receive(:blank?).and_return(false)
        allow(mock_relation).to receive(:inject).with(0.to_d) do |_init, &block|
          [stub_row].inject(0.to_d, &block)
        end
        allow(mock_relation).to receive(:order).with(date: :asc).and_return([stub_row])

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
      subject(:call_operation) { operation.call(transactions:, space: space) }

      let(:transactions) { [build_stubbed(:income_transaction)] }

      before do
        mock_relation = instance_double(ActiveRecord::Relation)
        allow(mock_relation).to receive(:blank?).and_return(true)

        allow(operation).to receive(:get_expenses).and_return(Dry::Monads::Success(mock_relation))
      end

      it { is_expected.to be_success }

      it 'returns empty array' do
        result = call_operation.value!
        expect(result).to eq([])
      end
    end

    context 'with zero total expenses' do
      subject(:call_operation) { operation.call(transactions:, space: space) }

      let(:transactions) { Transactions::Transaction.where.not(id: nil) }

      before do
        mock_relation = instance_double(ActiveRecord::Relation)
        allow(mock_relation).to receive(:blank?).and_return(false)
        allow(mock_relation).to receive(:inject).with(0.to_d).and_return(0.to_d)

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
          result = operation.call(transactions: invalid_transactions, space: space)
          expect(result).to be_failure
          expect(result.failure).to include(:transactions)
          expect(result.failure[:transactions]).to include('should be a relation of transactions')
        end
      end
    end

    describe 'Edge Cases' do
      context 'with multiple transactions on same date' do
        subject(:call_operation) { operation.call(transactions:, space: space) }

        let(:transactions) { build_stubbed_list(:expense_transaction, 2) }

        before do
          same_date = Date.current
          row_one = instance_double(
            Transactions::Expense,
            date: same_date,
            expense: Money.from_amount(100.0, 'PHP')
          )
          row_two = instance_double(
            Transactions::Expense,
            date: same_date,
            expense: Money.from_amount(50.0, 'PHP')
          )
          stub_rows = [row_one, row_two]
          mock_relation = instance_double(ActiveRecord::Relation)
          allow(mock_relation).to receive(:blank?).and_return(false)
          allow(mock_relation).to receive(:inject).with(0.to_d) do |_init, &block|
            stub_rows.inject(0.to_d, &block)
          end
          allow(mock_relation).to receive(:order).with(date: :asc).and_return(stub_rows)

          allow(operation).to receive(:get_expenses).and_return(Dry::Monads::Success(mock_relation))
        end

        it { is_expected.to be_success }

        it 'groups transactions by date correctly' do
          result = call_operation.value!
          expect(result).to be_an(Array)
          expect(result.length).to eq(7)

          day_with_transactions = result.find { |day| day[:amount] != 0.0 }
          expect(day_with_transactions[:amount]).to eq(150.0)

          days_without_transactions = result.reject { |day| day[:amount] != 0.0 }
          expect(days_without_transactions.length).to eq(6)
          days_without_transactions.each do |day|
            expect(day[:amount]).to eq(0.0)
          end
        end
      end

      context 'with different booked currencies' do
        subject(:call_operation) { operation.call(transactions:, space: space) }

        let(:transactions) { build_stubbed_list(:expense_transaction, 2) }

        before do
          stub_rows = [
            instance_double(
              Transactions::Expense,
              date: Date.current,
              expense: Money.from_amount(100.0, 'PHP')
            ),
            instance_double(
              Transactions::Expense,
              date: 1.day.ago.to_date,
              expense: Money.from_amount(50.0, 'USD')
            )
          ]
          mock_relation = instance_double(ActiveRecord::Relation)
          allow(mock_relation).to receive(:blank?).and_return(false)
          allow(mock_relation).to receive(:inject).with(0.to_d) do |_init, &block|
            stub_rows.inject(0.to_d, &block)
          end
          allow(mock_relation).to receive(:order).with(date: :asc).and_return(stub_rows)

          allow(operation).to receive(:get_expenses).and_return(Dry::Monads::Success(mock_relation))
        end

        it { is_expected.to be_success }

        it 'expresses weekly rows in the space currency' do
          result = call_operation.value!
          expect(result).to be_an(Array)
          expect(result.length).to eq(7)

          days_with_transactions = result.reject { |day| day[:amount] == 0.0 }
          expect(days_with_transactions.length).to eq(2)

          currencies = days_with_transactions.map { |item| item[:currency] }.uniq
          expect(currencies).to eq(['PHP'])

          days_without_transactions = result.select { |day| day[:amount] == 0.0 }
          expect(days_without_transactions.length).to eq(5)
        end
      end
    end
  end
end
