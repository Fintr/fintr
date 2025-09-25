# frozen_string_literal: true

require 'rails_helper'
require 'dry/monads'

RSpec.describe Dashboards::Operations::ShowDashboardData do
  include Dry::Monads[:result]
  let(:operation) { described_class.new }
  let!(:space) { create(:space, code: 'test_space') }
  let!(:category) { create(:category, space: space, category_type: 'expense', name: 'Groceries') }
  let!(:account) { create(:account, space: space, name: 'Checking Account') }
  let!(:monthly_summary) { create(:monthly_financial_summary, space: space) }

  let(:valid_params) do
    {
      space_code: space.code
    }
  end

  # Mock successful results for sub-operations/queries
  let(:mocked_dashboard_data) { Success(space) }
  let(:mocked_financial_summary) { Success(monthly_summary) }
  let(:mocked_serialized_dashboard) do
    {
      id: space.id,
      goal_description: "Set your own financial freedom goal",
      category_options: [{ label: 'Groceries', value: 'Groceries' }],
      expense_category_options: [{ label: 'Groceries', value: 'Groceries' }],
      income_category_options: [],
      account_options: [{ label: 'Checking Account', value: 'Checking Account' }]
    }
  end

  # Instance doubles for sub-operations
  let(:mock_dashboard_query) { instance_double(Spaces::Queries::DashboardData) }
  let(:mock_financial_summary_query) { instance_double(MonthlyFinancialSummaries::Queries::CurrentMonthSummary) }

  describe '#call' do
    before do
      allow(Spaces::Queries::DashboardData).to receive(:call).and_return(mocked_dashboard_data)
      allow(MonthlyFinancialSummaries::Queries::CurrentMonthSummary).to receive(:call).and_return(mocked_financial_summary)
      allow(Spaces::Serializers::DashboardSerializer).to receive(:render_as_hash).and_return(mocked_serialized_dashboard)
      allow(Utils::Number).to receive(:format_number).and_return('1,000.00')
    end

    context 'with valid parameters and successful sub-operations' do
      subject(:call_operation) { operation.call(valid_params) }

      it { is_expected.to be_success }

      it 'calls Spaces::Queries::DashboardData with correct params' do
        call_operation
        expect(Spaces::Queries::DashboardData).to have_received(:call).with(params: valid_params)
      end

      it 'calls MonthlyFinancialSummaries::Queries::CurrentMonthSummary with correct params' do
        call_operation
        expect(MonthlyFinancialSummaries::Queries::CurrentMonthSummary).to have_received(:call).with(params: valid_params)
      end

      it 'serializes the dashboard data using DashboardSerializer' do
        call_operation
        expect(Spaces::Serializers::DashboardSerializer).to have_received(:render_as_hash).with(space)
      end

      it 'formats financial summary numbers using Utils::Number' do
        call_operation
        expect(Utils::Number).to have_received(:format_number).with(monthly_summary.total_income).once
        expect(Utils::Number).to have_received(:format_number).with(monthly_summary.total_expenses).once
        expect(Utils::Number).to have_received(:format_number).with(monthly_summary.net_savings).once
      end

      it 'returns combined data with financial summary' do
        result = call_operation.value!
        expect(result).to include(
          **mocked_serialized_dashboard,
          financial_summary: {
            total_income: '1,000.00',
            total_expenses: '1,000.00',
            net_savings: '1,000.00',
            savings_percentage: monthly_summary.savings_percentage,
            calculated_at: monthly_summary.calculated_at
          }
        )
      end
    end

    describe 'Validation Failures' do
      context 'when space_code is missing' do
        subject(:call_operation) { operation.call({ other_param: 'value' }) }

        it { is_expected.to be_failure }

        it 'returns space_code missing error' do
          expect(call_operation.failure).to include(space_code: ['is missing'])
        end
      end

      context 'when space_code is not a string' do
        subject(:call_operation) { operation.call(valid_params.merge(space_code: 123)) }

        it { is_expected.to be_failure }

        it 'returns space_code type error' do
          expect(call_operation.failure).to include(space_code: ['must be a string'])
        end
      end

      context 'when space_code is empty' do
        subject(:call_operation) { operation.call(valid_params.merge(space_code: '')) }

        it { is_expected.to be_success }

        it 'allows empty string as valid input' do
          expect(call_operation).to be_success
        end
      end
    end

    describe 'Sub-operation/Query Failures' do
      let(:mocked_failure_monad) { Failure("Sub-operation failed") }

      context 'when get_dashboard_data fails' do
        before { allow(Spaces::Queries::DashboardData).to receive(:call).and_return(mocked_failure_monad) }

        it { expect(operation.call(valid_params)).to be_failure }

        it 'returns the failure from dashboard data query' do
          expect(operation.call(valid_params).failure).to eq("Sub-operation failed")
        end
      end

      context 'when get_financial_summary fails' do
        before { allow(MonthlyFinancialSummaries::Queries::CurrentMonthSummary).to receive(:call).and_return(mocked_failure_monad) }

        it { expect(operation.call(valid_params)).to be_failure }

        it 'returns the failure from financial summary query' do
          expect(operation.call(valid_params).failure).to eq("Sub-operation failed")
        end
      end
    end

    describe 'Data Combination' do
      subject(:call_operation) { operation.call(valid_params) }

      let(:custom_dashboard_data) { instance_double(Spaces::Space, id: 999) }
      let(:custom_financial_summary) do
        instance_double(MonthlyFinancialSummary,
                        total_income: Money.from_amount(5000, 'PHP'),
                        total_expenses: Money.from_amount(3000, 'PHP'),
                        net_savings: Money.from_amount(2000, 'PHP'),
                        savings_percentage: 40.0,
                        calculated_at: Time.current)
      end

      before do
        allow(Spaces::Queries::DashboardData).to receive(:call).and_return(Success(custom_dashboard_data))
        allow(MonthlyFinancialSummaries::Queries::CurrentMonthSummary).to receive(:call).and_return(Success(custom_financial_summary))
        allow(Spaces::Serializers::DashboardSerializer).to receive(:render_as_hash).with(custom_dashboard_data).and_return(mocked_serialized_dashboard)
        allow(Utils::Number).to receive(:format_number).with(custom_financial_summary.total_income).and_return('5,000.00')
        allow(Utils::Number).to receive(:format_number).with(custom_financial_summary.total_expenses).and_return('3,000.00')
        allow(Utils::Number).to receive(:format_number).with(custom_financial_summary.net_savings).and_return('2,000.00')
      end

      it 'combines dashboard data with financial summary correctly' do
        result = call_operation.value!
        expect(result).to include(
          **mocked_serialized_dashboard,
          financial_summary: {
            total_income: '5,000.00',
            total_expenses: '3,000.00',
            net_savings: '2,000.00',
            savings_percentage: 40.0,
            calculated_at: custom_financial_summary.calculated_at
          }
        )
      end

      it 'preserves all serialized dashboard data' do
        result = call_operation.value!
        expect(result).to include(
          id: space.id,
          goal_description: "Set your own financial freedom goal",
          category_options: [{ label: 'Groceries', value: 'Groceries' }],
          expense_category_options: [{ label: 'Groceries', value: 'Groceries' }],
          income_category_options: [],
          account_options: [{ label: 'Checking Account', value: 'Checking Account' }]
        )
      end
    end
  end
end
