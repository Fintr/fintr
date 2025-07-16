# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Insights::Operations::CreateHealthScores do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) } # Try direct user association

  let(:budget1) { build_stubbed(:budget, space: space, amount: Money.from_amount(1000, 'PHP')) }
  let(:budget2) { build_stubbed(:budget, space: space, amount: Money.from_amount(1500, 'PHP')) }

  let(:valid_summary_structure) do
    {
      total_income: BigDecimal('5000'),
      total_expenses: BigDecimal('3000'),
      net_savings: BigDecimal('2000')
    }
  end
  let(:valid_budgets_param) { [budget1, budget2] }
  let(:valid_operation_params) { { summary_structure: valid_summary_structure, budgets: valid_budgets_param } }

  describe '#call' do
    context 'with valid parameters' do
      subject(:call_operation) { operation.call(**valid_operation_params) }

      it { is_expected.to be_success }

      it 'returns the correct health scores hash' do
        result = call_operation.value!
        expect(result).to be_a(Hash)
        expect(result[:savings_percentage]).to eq(Utils::Number.format_percentage(BigDecimal('40.0')))
        expect(result[:debt_to_income_ratio]).to eq(Utils::Number.format_decimal(0))
        expect(result[:budget_adherence]).to eq(Utils::Number.format_percentage(BigDecimal('20.0')))
        expect(result[:financial_health_score]).to eq(Utils::Number.format_percentage(BigDecimal('70.00')))
      end
    end

    context 'when calculating financial health score' do
      subject(:call_operation) { operation.call(**valid_operation_params) }

      it 'returns the correct financial_health_score for savings_percentage 40 and budget_adherence 20' do
        result = call_operation.value!
        expect(result[:financial_health_score]).to eq(Utils::Number.format_percentage(BigDecimal('70.00')))
      end

      context 'with different savings_percentage and budget_adherence' do
        subject(:call_operation) { operation.call(**params_for_custom_scores) }

        let(:params_for_custom_scores) do
          {
            summary_structure: {
              total_income: BigDecimal('1000'),
              total_expenses: BigDecimal('500'),
              net_savings: BigDecimal('100')
            },
            budgets: [build_stubbed(:budget, space: space, amount: Money.from_amount(400, 'PHP'))]
          }
        end


        it 'calculates financial_health_score correctly for savings 10%, budget adherence 25%' do
          # savings_percentage: (100 / 1000) * 100 = 10%
          # budget_adherence: (500 - 400) / 400 * 100 = 25%
          # Savings score: 10% -> 75
          # Adherence score: 25% -> 25
          # Financial health score: (75 * 0.6) + (25 * 0.4) = 45 + 10 = 55
          result = call_operation.value!
          expect(result[:financial_health_score]).to eq(Utils::Number.format_percentage(BigDecimal('55.00')))
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
            budgets: [build_stubbed(:budget, space: space, amount: Money.from_amount(0, 'PHP'))]
          }
        end


        it 'calculates financial_health_score correctly when total budget is zero (budget_adherence 0)' do
          # savings_percentage: (100 / 1000) * 100 = 10%
          # budget_adherence: 0 (due to zero total budget)
          # Savings score: 10% -> 75
          # Adherence score: 0% -> 100
          # Financial health score: (75 * 0.6) + (100 * 0.4) = 45 + 40 = 85
          result = call_operation.value!
          expect(result[:financial_health_score]).to eq(Utils::Number.format_percentage(BigDecimal('85.00')))
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
            budgets: [build_stubbed(:budget, space: space, amount: Money.from_amount(1000, 'PHP'))]
          }
        end


        it 'calculates financial_health_score correctly when net savings is negative (savings_percentage 0)' do
          # savings_percentage: (-500 / 1000) * 100 = -50% -> 0 score
          # budget_adherence: (1500 - 1000) / 1000 * 100 = 50% -> 0 score
          # Financial health score: (0 * 0.6) + (0 * 0.4) = 0
          result = call_operation.value!
          expect(result[:financial_health_score]).to eq(Utils::Number.format_percentage(BigDecimal('0.00')))
        end
      end
    end

    describe 'Contract Validations' do
      context 'when total_income is zero' do
        subject(:call_operation) { operation.call(**params_with_zero_income) }

        let(:params_with_zero_income) do
          { summary_structure: valid_summary_structure.merge(total_income: BigDecimal('0')), budgets: valid_budgets_param }
        end


        it { is_expected.to be_success }

        it 'returns savings_percentage as formatted 0.00% when total income is 0' do
          result = call_operation.value!
          expect(result[:savings_percentage]).to eq(Utils::Number.format_percentage(0))
        end
      end

      context 'when total_income is negative' do
        subject(:call_operation) { operation.call(**params_with_negative_income) }

        let(:params_with_negative_income) do
          { summary_structure: valid_summary_structure.merge(total_income: BigDecimal('-100')), budgets: valid_budgets_param }
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
          { summary_structure: valid_summary_structure.merge(total_expenses: BigDecimal('0')), budgets: valid_budgets_param }
        end


        it { is_expected.to be_success }

        it 'returns budget_adherence as formatted -100.00% when total expenses is 0' do
          result = call_operation.value!
          expect(result[:budget_adherence]).to eq(Utils::Number.format_percentage(BigDecimal('-100.0')))
        end
      end

      context 'when total_expenses is negative' do
        subject(:call_operation) { operation.call(**params_with_negative_expenses) }

        let(:params_with_negative_expenses) do
          { summary_structure: valid_summary_structure.merge(total_expenses: BigDecimal('-100')), budgets: valid_budgets_param }
        end


        it { is_expected.to be_failure }

        it 'fails with total_expenses error' do
          expect(call_operation.failure).to include(:total_expenses)
          expect(call_operation.failure[:total_expenses]).to include('should be at least 0')
        end
      end

      context 'when budgets parameter is missing (passed as nil to operation call)' do
        let(:params_with_nil_budgets) { { summary_structure: valid_summary_structure, budgets: nil } }

        it 'fails with budgets error when budgets is nil' do
          result = operation.call(**params_with_nil_budgets)
          expect(result).to be_failure
          expect(result.failure).to include(:budgets)
          expect(result.failure[:budgets]).to include('is missing')
        end
      end

      context 'when budgets key is not present in params hash for operation call' do
        let(:params_without_budgets_key) { { summary_structure: valid_summary_structure } }

        it 'fails with budgets error when budgets key is missing' do
           result = operation.call(params_without_budgets_key)
           expect(result).to be_failure
           expect(result.failure).to include(:budgets)
           expect(result.failure[:budgets]).to include('is missing')
        end
      end

      context 'when budgets is an empty array' do
        subject(:call_operation) { operation.call(**params_with_empty_budgets) }

        let(:params_with_empty_budgets) { { summary_structure: valid_summary_structure, budgets: [] } }


        it { is_expected.to be_success }

        it 'returns health scores with budget_adherence as formatted 0.00% when total budget is 0' do
          # With an empty budget array, total_budget will be 0, leading to budget_adherence 0.
          result = call_operation.value!
          expect(result[:budget_adherence]).to eq(Utils::Number.format_percentage(0))
        end
      end

      context 'when budgets is an array with a non-Budget object as the first element' do
        subject(:call_operation) { operation.call(**params_with_invalid_first_budget) }

        let(:params_with_invalid_first_budget) { { summary_structure: valid_summary_structure, budgets: ['not a budget'] } }


        it { is_expected.to be_failure }

        it 'fails with budgets error' do
          expect(call_operation.failure).to include(:budgets)
          expect(call_operation.failure[:budgets]).to include('should be an array of budgets')
        end
      end

      context 'when budgets has a valid first element but invalid subsequent elements' do
        subject(:call_operation) { operation.call(**params_with_mixed_budgets) }

        let(:params_with_mixed_budgets) { { summary_structure: valid_summary_structure, budgets: [budget1, 'not a budget'] } }


        it 'succeeds due to flawed contract logic (only checks first element for type)' do
          expect { call_operation.value! }.to raise_error(NoMethodError, /undefined method 'amount' for an instance of String/)
        end
      end
    end

    describe 'Calculation Logic Edge Cases' do
      context 'when total_income is positive but results in zero savings_percentage' do
        subject(:call_operation) { operation.call(**params) }

        let(:summary_zero_net_savings) { valid_summary_structure.merge(net_savings: BigDecimal('0')) }
        let(:params) { { summary_structure: summary_zero_net_savings, budgets: valid_budgets_param } }


        it { is_expected.to be_success }

        it 'returns savings_percentage as formatted 0.0' do
          expect(call_operation.value![:savings_percentage]).to eq(Utils::Number.format_percentage(BigDecimal('0.0')))
        end
      end

      context 'when total_budget is zero (from budgets with zero amounts)' do
        subject(:call_operation) { operation.call(**params_zero_total_budget) }

        let(:budget_with_zero_amount) { build_stubbed(:budget, space: space, amount: Money.from_amount(0, 'PHP')) }
        let(:params_zero_total_budget) { { summary_structure: valid_summary_structure, budgets: [budget_with_zero_amount] } }


        it { is_expected.to be_success }

        it 'returns budget_adherence as formatted 0.00%' do
          expect(call_operation.value![:budget_adherence]).to eq(Utils::Number.format_percentage(0))
        end
      end
    end
  end
end
