# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Budgets::Operations::PrepareMonthlyReport do
  let(:operation) { described_class.new }
  let!(:space) { create(:space) }
  let(:test_date) { Date.new(2024, 7, 15) }

  describe '#call' do
    subject(:call_operation) { operation.call(params) }

    context 'when the operation is successful with date parameter' do
      let(:params) do
        {
          space_code: space.code,
          date: test_date
        }
      end

      let!(:food_category) { create(:category, space:, category_type: "expense", name: "Food") }
      let!(:transport_category) { create(:category, space:, category_type: "expense", name: "Transport") }
      let(:mock_transactions_query) { instance_double(ActiveRecord::Relation, sum: 15000) }

      before do
        create(
          :budget,
          space:,
          category: food_category,
          date: test_date.beginning_of_month,
          amount_cents: 10_000,
          amount_currency: "PHP",
        )
        create(
          :budget,
          space:,
          category: transport_category,
          date: test_date.beginning_of_month,
          amount_cents: 20_000,
          amount_currency: "PHP",
        )

        allow(Budgets::Queries::MonthlyBudgets).to receive(:call).and_return(
          Dry::Monads::Success(Budget.none)
        )
        allow(Transactions::Queries::FilteredTransactions).to receive(:call).and_return(
          Dry::Monads::Success(mock_transactions_query)
        )
      end

      it { is_expected.to be_success }

      it 'returns the correct output structure' do
        result = call_operation
        expect(result).to be_success
        output = result.value!
        expect(output).to be_a(Hash)
        expect(output).to have_key(:budgets)
        expect(output).to have_key(:summary)
      end

      it 'returns serialized budgets' do
        result = call_operation
        expect(result).to be_success
        output = result.value!
        expect(output[:budgets]).to be_an(Array)
        expect(output[:budgets].length).to eq(2)
      end

      it 'calculates summary correctly' do
        result = call_operation
        expect(result).to be_success
        output = result.value!
        summary = output[:summary]
        expect(summary[:total_budget]).to eq(300) # (10000 + 20000) / 100
        expect(summary[:total_spent]).to eq(150) # 15000 / 100
        expect(summary[:total_spent_percentage]).to eq(50.0) # (150 / 300 * 100)
        expect(summary[:remaining]).to eq(150) # 300 - 150
      end

      it 'calls MonthlyBudgets query with correct date range' do
        call_operation
        expect(Budgets::Queries::MonthlyBudgets).to have_received(:call).with(
          params: {
            space_code: space.code,
            start_date: test_date.beginning_of_month,
            end_date: test_date.end_of_month
          }
        )
      end

      it 'calls FilteredTransactions query with correct parameters' do
        call_operation
        expect(Transactions::Queries::FilteredTransactions).to have_received(:call).with(
          params: {
            space_code: space.code,
            start_date: test_date.beginning_of_month,
            end_date: test_date.end_of_month,
            category_name: nil,
            balance_state: "calculated",
            transaction_type: "Transactions::Expense",
            paginate: false
          }
        )
      end
    end

    context 'when the operation is successful with start_date and end_date parameters' do
      let(:params) do
        {
          space_code: space.code,
          start_date: Date.new(2024, 7, 1),
          end_date: Date.new(2024, 7, 31)
        }
      end

      let!(:utilities_category) { create(:category, space:, category_type: "expense", name: "Utilities") }
      let(:mock_transactions_query) { instance_double(ActiveRecord::Relation, sum: 2500) }

      before do
        create(
          :budget,
          space:,
          category: utilities_category,
          date: params[:start_date].beginning_of_month,
          amount_cents: 5000,
          amount_currency: "PHP",
        )

        allow(Budgets::Queries::MonthlyBudgets).to receive(:call).and_return(
          Dry::Monads::Success(Budget.none)
        )
        allow(Transactions::Queries::FilteredTransactions).to receive(:call).and_return(
          Dry::Monads::Success(mock_transactions_query)
        )
      end

      it { is_expected.to be_success }

      it 'calls MonthlyBudgets query with correct date range' do
        call_operation
        expect(Budgets::Queries::MonthlyBudgets).to have_received(:call).with(
          params: {
            space_code: space.code,
            start_date: params[:start_date],
            end_date: params[:end_date]
          }
        )
      end

      it 'calculates summary correctly' do
        result = call_operation
        expect(result).to be_success
        output = result.value!
        summary = output[:summary]
        expect(summary[:total_budget]).to eq(50) # 5000 / 100
        expect(summary[:total_spent]).to eq(25) # 2500 / 100
        expect(summary[:total_spent_percentage]).to eq(50.0) # (25 / 50 * 100)
        expect(summary[:remaining]).to eq(25) # 50 - 25
      end
    end

    context 'with validation errors' do
      context 'when space_code is missing' do
        let(:params) do
          {
            date: test_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with space_code missing error' do
          expect(call_operation.failure).to have_key(:space_code)
        end
      end

      context 'when both date and start_date/end_date are missing' do
        let(:params) do
          {
            space_code: space.code
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with date validation error' do
          expect(call_operation.failure).to have_key(:date)
          expect(call_operation.failure[:date]).to include("either date or both start_date and end_date must be provided")
        end
      end

      context 'when only start_date is provided without end_date' do
        let(:params) do
          {
            space_code: space.code,
            start_date: test_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with date validation error' do
          expect(call_operation.failure).to have_key(:date)
          expect(call_operation.failure[:date]).to include("either date or both start_date and end_date must be provided")
        end
      end

      context 'when only end_date is provided without start_date' do
        let(:params) do
          {
            space_code: space.code,
            end_date: test_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with date validation error' do
          expect(call_operation.failure).to have_key(:date)
          expect(call_operation.failure[:date]).to include("either date or both start_date and end_date must be provided")
        end
      end

      context 'when both date and start_date/end_date are provided' do
        let(:params) do
          {
            space_code: space.code,
            date: test_date,
            start_date: Date.new(2024, 7, 1),
            end_date: Date.new(2024, 7, 31)
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with date validation error' do
          expect(call_operation.failure).to have_key(:date)
          expect(call_operation.failure[:date]).to include("cannot provide both date and start_date/end_date")
        end
      end

      context 'when start_date is after end_date' do
        let(:params) do
          {
            space_code: space.code,
            start_date: Date.new(2024, 7, 31),
            end_date: Date.new(2024, 7, 1)
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with end_date validation error' do
          expect(call_operation.failure).to have_key(:end_date)
          expect(call_operation.failure[:end_date]).to include("must be after start_date")
        end
      end

      context 'when date is not a valid date' do
        let(:params) do
          {
            space_code: space.code,
            date: 'not-a-date'
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with date type error' do
          expect(call_operation.failure).to have_key(:date)
        end
      end

      context 'when start_date is not a valid date' do
        let(:params) do
          {
            space_code: space.code,
            start_date: 'not-a-date',
            end_date: test_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with start_date type error' do
          expect(call_operation.failure).to have_key(:start_date)
        end
      end

      context 'when end_date is not a valid date' do
        let(:params) do
          {
            space_code: space.code,
            start_date: test_date,
            end_date: 'not-a-date'
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with end_date type error' do
          expect(call_operation.failure).to have_key(:end_date)
        end
      end
    end

    context 'when the space is not found' do
      let(:params) do
        {
          space_code: 'non-existent-space-code',
          date: test_date
        }
      end

      it { is_expected.to be_failure }

      it 'returns a failure with space_code not found error' do
        expect(call_operation.failure).to eq({ space_code: "Not found" })
      end
    end

    context 'when MonthlyBudgets query fails' do
      let(:params) do
        {
          space_code: space.code,
          date: test_date
        }
      end

      before do
        allow(Budgets::Queries::MonthlyBudgets).to receive(:call).and_return(
          Dry::Monads::Failure({ error: "Query failed" })
        )
      end

      it { is_expected.to be_failure }

      it 'returns the query failure' do
        expect(call_operation.failure).to eq({ error: "Query failed" })
      end
    end

    context 'when FilteredTransactions query fails' do
      let(:params) do
        {
          space_code: space.code,
          date: test_date
        }
      end

      let(:mock_monthly_budgets_query) { instance_double(ActiveRecord::Relation, to_a: []) }

      before do
        allow(Budgets::Queries::MonthlyBudgets).to receive(:call).and_return(
          Dry::Monads::Success(mock_monthly_budgets_query)
        )
        allow(Transactions::Queries::FilteredTransactions).to receive(:call).and_return(
          Dry::Monads::Failure({ error: "Transaction query failed" })
        )
      end

      it { is_expected.to be_failure }

      it 'returns the query failure' do
        expect(call_operation.failure).to eq({ error: "Transaction query failed" })
      end
    end

    context 'when there are no budgets' do
      let(:params) do
        {
          space_code: space.code,
          date: test_date
        }
      end

      let(:mock_monthly_budgets_query) { instance_double(ActiveRecord::Relation, to_a: []) }
      let(:mock_transactions_query) { instance_double(ActiveRecord::Relation, sum: 0) }

      before do
        allow(Budgets::Queries::MonthlyBudgets).to receive(:call).and_return(
          Dry::Monads::Success(mock_monthly_budgets_query)
        )
        allow(Transactions::Queries::FilteredTransactions).to receive(:call).and_return(
          Dry::Monads::Success(mock_transactions_query)
        )
        allow(Budgets::Serializers::MonthlyBudgetsSerializer).to receive(:render_as_hash)
          .with([])
          .and_return([])
      end

      it { is_expected.to be_success }

      it 'returns empty budgets array' do
        result = call_operation
        expect(result).to be_success
        output = result.value!
        expect(output).to be_a(Hash)
        expect(output[:budgets]).to eq([])
      end

      it 'calculates summary with zero values' do
        result = call_operation
        expect(result).to be_success
        output = result.value!
        expect(output).to be_a(Hash)
        summary = output[:summary]
        expect(summary[:total_budget]).to eq(0)
        expect(summary[:total_spent]).to eq(0)
        expect(summary[:remaining]).to eq(0)
      end
    end
  end
end
