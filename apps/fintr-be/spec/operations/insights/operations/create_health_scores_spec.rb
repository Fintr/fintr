# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Insights::Operations::CreateHealthScores do
  include Dry::Monads[:result]
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }

  let(:budget1) { build_stubbed(:budget, space: space, amount: Money.from_amount(1000, 'PHP')) }
  let(:budget2) { build_stubbed(:budget, space: space, amount: Money.from_amount(1500, 'PHP')) }

  let(:valid_summary_structure) do
    {
      total_income: BigDecimal('5000'),
      total_expenses: BigDecimal('3000'),
      net_savings: BigDecimal('2000')
    }
  end
  let(:valid_budget_records) { [budget1, budget2] }
  let(:valid_operation_params) do
    {
      summary_structure: valid_summary_structure,
      budget_records: valid_budget_records,
      transactions: Transactions::Transaction.none,
      space:
    }
  end

  def stub_budget_usage(total_budget:, total_expenses:)
    usage_percentage =
      total_budget.zero? ? 0.to_d : (total_expenses.to_d / total_budget.to_d * 100)
    remaining = total_budget.to_d - total_expenses.to_d
    compute = instance_double(Insights::Operations::ComputeBudgetUsage)
    allow(Insights::Operations::ComputeBudgetUsage).to receive(:new).and_return(compute)
    allow(compute).to receive(:call).and_return(
      Success(
        total_budget: total_budget.to_d,
        total_expenses: total_expenses.to_d,
        usage_percentage:,
        remaining:,
        over_amount: remaining.negative? ? -remaining : 0.to_d
      )
    )
  end

  describe '#call' do
    context 'with valid parameters' do
      subject(:call_operation) { operation.call(**valid_operation_params) }

      before { stub_budget_usage(total_budget: 2500, total_expenses: 3000) }

      it { is_expected.to be_success }

      it 'returns the correct health scores hash' do
        result = call_operation.value!
        expect(result).to be_a(Hash)
        expect(result[:savings_percentage]).to include(
          percentage: Utils::Number.format_percentage(BigDecimal('40.0')),
          score: 100
        )
        expect(result[:savings_percentage][:calculation][:labeled_formula]).to eq(
          "(Net savings ÷ Total income) × 100"
        )
        expect(result[:debt_to_income_ratio]).to include(
          percentage: Utils::Number.format_percentage(0),
          score: 100,
          monthly_debt: Utils::Number.format_number(0)
        )
        expect(result[:budget_usage]).to include(
          percentage: Utils::Number.format_percentage(BigDecimal('120.0')),
          score: 70
        )
        expect(result[:calculation][:labeled_formula]).to include("50%")
        expect(result[:financial_health_score]).to eq(Utils::Number.format_percentage(BigDecimal('91.00')))
      end
    end

    context 'when calculating financial health score' do
      subject(:call_operation) { operation.call(**valid_operation_params) }

      before { stub_budget_usage(total_budget: 2500, total_expenses: 3000) }

      it 'returns the correct financial_health_score for savings_percentage 40 and budget_usage 120' do
        result = call_operation.value!
        expect(result[:financial_health_score]).to eq(Utils::Number.format_percentage(BigDecimal('91.00')))
      end

      context 'with different savings_percentage and budget_usage' do
        subject(:call_operation) { operation.call(**params_for_custom_scores) }

        let(:params_for_custom_scores) do
          {
            summary_structure: {
              total_income: BigDecimal('1000'),
              total_expenses: BigDecimal('500'),
              net_savings: BigDecimal('100')
            },
            budget_records: [build_stubbed(:budget, space: space, amount: Money.from_amount(400, 'PHP'))],
            transactions: Transactions::Transaction.none,
            space:
          }
        end

        before { stub_budget_usage(total_budget: 400, total_expenses: 500) }

        it 'calculates financial_health_score correctly for savings 10%, budget usage 125%' do
          # savings_percentage: (100 / 1000) * 100 = 10%
          # budget_usage: (500 / 400) * 100 = 125%
          # Savings score: 10% -> 75
          # Budget usage score: 125% -> 70
          # Financial health score: (75 * 0.5) + (70 * 0.3) + (100 * 0.2) = 37.5 + 21 + 20 = 78.5
          result = call_operation.value!
          expect(result[:financial_health_score]).to eq(Utils::Number.format_percentage(BigDecimal('78.50')))
        end
      end

      context 'with zero total budget leading to 0 budget adherence' do
        subject(:call_operation) { operation.call(**params_zero_total_budget) }

        let(:params_zero_total_budget) do
          {
            summary_structure: {
              total_income: BigDecimal('1000'),
              total_expenses: BigDecimal('500'),
              net_savings: BigDecimal('100')
            },
            budget_records: [build_stubbed(:budget, space: space, amount: Money.from_amount(0, 'PHP'))],
            transactions: Transactions::Transaction.none,
            space:
          }
        end

        before { stub_budget_usage(total_budget: 0, total_expenses: 500) }

        it 'calculates financial_health_score correctly when total budget is zero (budget_usage 0)' do
          # savings_percentage: (100 / 1000) * 100 = 10%
          # budget_usage: 0 (due to zero total budget)
          # Savings score: 10% -> 75
          # Budget usage score: 0% -> 0
          # Financial health score: (75 * 0.5) + (0 * 0.3) + (100 * 0.2) = 37.5 + 0 + 20 = 57.5
          result = call_operation.value!
          expect(result[:financial_health_score]).to eq(Utils::Number.format_percentage(BigDecimal('57.50')))
        end
      end

      context 'when net savings is negative' do
        subject(:call_operation) { operation.call(**params_negative_net_savings) }

        let(:params_negative_net_savings) do
          {
            summary_structure: {
              total_income: BigDecimal('1000'),
              total_expenses: BigDecimal('1500'),
              net_savings: BigDecimal('-500')
            },
            budget_records: [build_stubbed(:budget, space: space, amount: Money.from_amount(1000, 'PHP'))],
            transactions: Transactions::Transaction.none,
            space:
          }
        end

        before { stub_budget_usage(total_budget: 1000, total_expenses: 1500) }

        it 'calculates financial_health_score correctly when net savings is negative (savings_percentage 0)' do
          # savings_percentage: (-500 / 1000) * 100 = -50% -> 0 score
          # budget_usage: (1500 / 1000) * 100 = 150% -> 40 score
          # Financial health score: (0 * 0.5) + (40 * 0.3) + (100 * 0.2) = 0 + 12 + 20 = 32
          result = call_operation.value!
          expect(result[:financial_health_score]).to eq(Utils::Number.format_percentage(BigDecimal('32.00')))
        end
      end
    end

    describe 'Contract Validations' do
      context 'when total_income is zero' do
        subject(:call_operation) { operation.call(**params_with_zero_income) }

        let(:params_with_zero_income) do
          valid_operation_params.merge(summary_structure: valid_summary_structure.merge(total_income: BigDecimal('0')))
        end

        before { stub_budget_usage(total_budget: 2500, total_expenses: 3000) }

        it { is_expected.to be_success }

        it 'returns savings_percentage as formatted hash when total income is 0' do
          result = call_operation.value!
          expect(result[:savings_percentage]).to include(
            percentage: Utils::Number.format_percentage(0),
            score: 0
          )
        end
      end

      context 'when total_income is negative' do
        subject(:call_operation) { operation.call(**params_with_negative_income) }

        let(:params_with_negative_income) do
          valid_operation_params.merge(summary_structure: valid_summary_structure.merge(total_income: BigDecimal('-100')))
        end

        it { is_expected.to be_failure }

        it 'fails with total_income error' do
          expect(call_operation.failure).to include(:total_income)
          expect(call_operation.failure[:total_income]).to include('should be at least 0')
        end
      end

      context 'when total_expenses is zero' do
        subject(:call_operation) { operation.call(**params_with_zero_expenses) }

        let(:params_with_zero_expenses) do
          valid_operation_params.merge(summary_structure: valid_summary_structure.merge(total_expenses: BigDecimal('0')))
        end

        before { stub_budget_usage(total_budget: 2500, total_expenses: 0) }

        it { is_expected.to be_success }

        it 'returns budget_usage as formatted hash when total expenses is 0' do
          result = call_operation.value!
          expect(result[:budget_usage]).to include(
            percentage: Utils::Number.format_percentage(BigDecimal('0.0')),
            score: 100
          )
        end
      end

      context 'when total_expenses is negative' do
        subject(:call_operation) { operation.call(**params_with_negative_expenses) }

        let(:params_with_negative_expenses) do
          valid_operation_params.merge(summary_structure: valid_summary_structure.merge(total_expenses: BigDecimal('-100')))
        end

        it { is_expected.to be_failure }

        it 'fails with total_expenses error' do
          expect(call_operation.failure).to include(:total_expenses)
          expect(call_operation.failure[:total_expenses]).to include('should be at least 0')
        end
      end

      context 'when budget_records is nil' do
        it 'fails with budget_records error' do
          result = operation.call(**valid_operation_params.merge(budget_records: nil))
          expect(result).to be_failure
          expect(result.failure).to include(:budget_records)
        end
      end

      context 'when budget_records is an empty array' do
        subject(:call_operation) { operation.call(**params_with_empty_budget_records) }

        let(:params_with_empty_budget_records) do
          valid_operation_params.merge(budget_records: [])
        end

        before { stub_budget_usage(total_budget: 0, total_expenses: 0) }

        it { is_expected.to be_success }

        it 'returns health scores with budget_usage as formatted hash when total budget is 0' do
          result = call_operation.value!
          expect(result[:budget_usage]).to include(
            percentage: Utils::Number.format_percentage(0),
            score: 0
          )
        end
      end
    end

    describe 'Calculation Logic Edge Cases' do
      context 'when total_income is positive but results in zero savings_percentage' do
        subject(:call_operation) { operation.call(**params) }

        let(:summary_zero_net_savings) { valid_summary_structure.merge(net_savings: BigDecimal('0')) }
        let(:params) { valid_operation_params.merge(summary_structure: summary_zero_net_savings) }

        before { stub_budget_usage(total_budget: 2500, total_expenses: 3000) }

        it { is_expected.to be_success }

        it 'returns savings_percentage as formatted hash with 0.0 percentage' do
          expect(call_operation.value![:savings_percentage]).to include(
            percentage: Utils::Number.format_percentage(BigDecimal('0.0')),
            score: 0
          )
        end
      end

      context 'when total_budget is zero (from budgets with zero amounts)' do
        subject(:call_operation) { operation.call(**params_zero_total_budget) }

        let(:budget_with_zero_amount) { build_stubbed(:budget, space: space, amount: Money.from_amount(0, 'PHP')) }
        let(:params_zero_total_budget) do
          valid_operation_params.merge(budget_records: [budget_with_zero_amount])
        end

        before { stub_budget_usage(total_budget: 0, total_expenses: 3000) }

        it { is_expected.to be_success }

        it 'returns budget_usage as formatted hash with 0.00% percentage' do
          expect(call_operation.value![:budget_usage]).to include(
            percentage: Utils::Number.format_percentage(0),
            score: 0
          )
        end
      end
    end
  end
end
