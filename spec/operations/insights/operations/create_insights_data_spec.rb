# frozen_string_literal: true

require 'rails_helper'
require 'dry/monads'

RSpec.describe Insights::Operations::CreateInsightsData do
  include Dry::Monads[:result, :do]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user], code: 'test_space') } # ensure space has a code

  let(:category_name) { 'Groceries' }
  let(:start_date) { Date.new(2023, 1, 1) }
  let(:end_date) { Date.new(2023, 1, 31) }

  let(:valid_params) do
    {
      balance_state: 'calculated',
      space_code: space.code,
      category_name: category_name,
      start_date: start_date,
      end_date: end_date
    }
  end

  # Mocked successful results for sub-operations/queries
  let(:mocked_transactions_result) { Success(instance_double(ActiveRecord::Relation, :transactions, to_ary: [])) } # Ensure it can be destructured if needed by `Do`
  let(:mocked_budgets_result) { Success(instance_double(ActiveRecord::Relation, :budgets, to_ary: [])) } # Ensure it can be destructured
  let(:mocked_summary_structure_result) { Success({ total_income: 5000, total_expenses: 3000 }) }
  let(:mocked_health_scores_result) { Success({ savings_rate: '20%' }) }
  let(:mocked_expense_breakdown_result) { Success([{ category: 'Food', amount: 100 }]) }
  let(:mocked_weekly_spending_result) { Success([{ week: 1, amount: 50 }]) }

  # Instance doubles for sub-operations
  let(:mock_create_summary_structure_op) { instance_double(Insights::Operations::CreateSummaryStructure) }
  let(:mock_create_health_scores_op) { instance_double(Insights::Operations::CreateHealthScores) }
  let(:mock_create_expense_breakdown_op) { instance_double(Insights::Operations::CreateExpenseBreakdown) }
  let(:mock_create_weekly_spending_op) { instance_double(Insights::Operations::CreateWeeklySpending) }

  describe '#call' do
    before do
      allow(Spaces::Space).to receive(:find_by).with(code: space.code).and_return(space)
      allow(Spaces::Space).to receive(:find_by).with(code: 'invalid_code').and_return(nil)

      allow(Transactions::Queries::FilteredTransactions).to receive(:call).and_return(mocked_transactions_result)
      allow(Budgets::Queries::MonthlyBudgets).to receive(:call).and_return(mocked_budgets_result)

      allow(Insights::Operations::CreateSummaryStructure).to receive(:new).and_return(mock_create_summary_structure_op)
      allow(mock_create_summary_structure_op).to receive(:call).and_return(mocked_summary_structure_result)

      allow(Insights::Operations::CreateHealthScores).to receive(:new).and_return(mock_create_health_scores_op)
      allow(mock_create_health_scores_op).to receive(:call).and_return(mocked_health_scores_result)

      allow(Insights::Operations::CreateExpenseBreakdown).to receive(:new).and_return(mock_create_expense_breakdown_op)
      allow(mock_create_expense_breakdown_op).to receive(:call).and_return(mocked_expense_breakdown_result)

      allow(Insights::Operations::CreateWeeklySpending).to receive(:new).and_return(mock_create_weekly_spending_op)
      allow(mock_create_weekly_spending_op).to receive(:call).and_return(mocked_weekly_spending_result)
    end

    context 'with valid parameters and successful sub-operations' do
      subject(:call_operation) { operation.call(valid_params) }

      it { is_expected.to be_success }

      it 'returns the aggregated insights data' do
        result = call_operation.value!
        expect(result).to eq({
          summary_structure: mocked_summary_structure_result.value!,
          health_scores: mocked_health_scores_result.value!,
          expense_breakdown: mocked_expense_breakdown_result.value!,
          weekly_spending: mocked_weekly_spending_result.value!
        })
      end

      it 'calls Transactions::Queries::FilteredCombined with correct params' do
        call_operation
        expect(Transactions::Queries::FilteredTransactions).to have_received(:call).with(params: valid_params)
      end

      it 'calls Budgets::Queries::MonthlyBudgets with correct params' do
        call_operation
        expect(Budgets::Queries::MonthlyBudgets).to have_received(:call).with(params: {
          space_code: valid_params[:space_code],
          date: valid_params[:start_date]
        })
      end

      it 'calls Insights::Operations::CreateSummaryStructure with transactions' do
        # We need to allow the .call to be checked for arguments
        # allow(mock_create_summary_structure_op).to receive(:call).and_call_original if mocked_transactions_result.success? # only if we expect success <- REMOVE THIS LINE
        # Or, more simply, just expect it to be called with the success value
        expect(mock_create_summary_structure_op).to receive(:call).with(transactions: mocked_transactions_result.value!).and_return(mocked_summary_structure_result) # Ensure it returns the expected monad
        call_operation
      end

      it 'calls Insights::Operations::CreateHealthScores with summary_structure and budgets' do
        expect(mock_create_health_scores_op).to receive(:call).with(summary_structure: mocked_summary_structure_result.value!, budgets: mocked_budgets_result.value!).and_return(mocked_health_scores_result) # Ensure it returns the expected monad
        call_operation
      end

      it 'calls Insights::Operations::CreateExpenseBreakdown with transactions' do
        expect(mock_create_expense_breakdown_op).to receive(:call).with(transactions: mocked_transactions_result.value!).and_return(mocked_expense_breakdown_result) # Ensure it returns the expected monad
        call_operation
      end

      it 'calls Insights::Operations::CreateWeeklySpending with transactions' do
        expect(mock_create_weekly_spending_op).to receive(:call).with(transactions: mocked_transactions_result.value!).and_return(mocked_weekly_spending_result) # Ensure it returns the expected monad
        call_operation
      end
    end

    describe 'Validation Failures' do
      context 'when space_code is missing' do
        subject { operation.call(valid_params.except(:space_code)) }

        it { is_expected.to be_failure }

        it 'returns space_code missing error' do
          expect(subject.failure).to include(space_code: ['is missing'])
        end
      end

      context 'when category_name is missing' do
        subject { operation.call(valid_params.except(:category_name)) }

        it { is_expected.to be_failure }

        it 'returns category_name missing error' do
          expect(subject.failure).to include(category_name: ['is missing'])
        end
      end

      context 'when start_date is missing' do
        subject { operation.call(valid_params.except(:start_date)) }

        it { is_expected.to be_failure }

        it 'returns start_date missing error' do
          expect(subject.failure).to include(start_date: ['is missing'])
        end
      end

      context 'when end_date is missing' do
        subject { operation.call(valid_params.except(:end_date)) }

        it { is_expected.to be_failure }

        it 'returns end_date missing error' do
          expect(subject.failure).to include(end_date: ['is missing'])
        end
      end

      context 'when space_code is not found' do
        subject { operation.call(valid_params.merge(space_code: 'invalid_code')) }

        it { is_expected.to be_failure }

        it 'returns space_code not found error' do
          expect(subject.failure).to eq(space_code: 'Not found')
        end
      end
    end

    describe 'Sub-operation/Query Failures' do
      let(:mocked_failure_monad) { Failure("Sub-operation failed") } # Renamed from mocked_failure to avoid clash

      context 'when find_combined_transactions fails' do
        before { allow(Transactions::Queries::FilteredTransactions).to receive(:call).and_return(mocked_failure_monad) }

        it { expect(operation.call(valid_params)).to be_failure }
        it { expect(operation.call(valid_params).failure).to eq("Sub-operation failed") }
      end

      context 'when find_budgets fails' do
        before { allow(Budgets::Queries::MonthlyBudgets).to receive(:call).and_return(mocked_failure_monad) }

        it { expect(operation.call(valid_params)).to be_failure }
        it { expect(operation.call(valid_params).failure).to eq("Sub-operation failed") }
      end

      context 'when create_summary_structure fails' do
        before { allow(mock_create_summary_structure_op).to receive(:call).and_return(mocked_failure_monad) }

        it { expect(operation.call(valid_params)).to be_failure }
        it { expect(operation.call(valid_params).failure).to eq("Sub-operation failed") }
      end

      context 'when create_health_scores fails' do
        before { allow(mock_create_health_scores_op).to receive(:call).and_return(mocked_failure_monad) }

        it { expect(operation.call(valid_params)).to be_failure }
        it { expect(operation.call(valid_params).failure).to eq("Sub-operation failed") }
      end

      context 'when create_expense_breakdown fails' do
        before { allow(mock_create_expense_breakdown_op).to receive(:call).and_return(mocked_failure_monad) }

        it { expect(operation.call(valid_params)).to be_failure }
        it { expect(operation.call(valid_params).failure).to eq("Sub-operation failed") }
      end

      context 'when create_weekly_spending fails' do
        before { allow(mock_create_weekly_spending_op).to receive(:call).and_return(mocked_failure_monad) }

        it { expect(operation.call(valid_params)).to be_failure }
        it { expect(operation.call(valid_params).failure).to eq("Sub-operation failed") }
      end
    end
  end
end
