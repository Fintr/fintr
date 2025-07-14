# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Budgets::Queries::MonthlyBudgets, type: :query do
  let!(:space) { create(:space, code: 'test-space') }
  let!(:other_space) { create(:space, code: 'other-space') }

  let!(:food_category) { create(:category, space: space, category_type: :expense, name: "Food") }
  let!(:transport_category) { create(:category, space: space, category_type: :expense, name: "Transport") }
  let!(:utilities_category) { create(:category, space: space, category_type: :expense, name: "Utilities") }
  let!(:hobby_category) { create(:category, space: space, category_type: :expense, name: "Hobbies") }
  let!(:prev_month_food_category) { create(:category, space: space, category_type: :expense, name: "Old Food") }
  let!(:other_space_category) { create(:category, space: other_space, category_type: :expense, name: "Other Space Entertainment") }

  let(:current_month_date) { Date.new(2024, 5, 15) }
  let(:prev_month_date) { current_month_date.prev_month }
  let(:next_month_date) { current_month_date.next_month }

  describe '#validate' do
    let(:valid_params) { { space_code: space.code, date: current_month_date } }

    context 'when params are valid' do
      subject(:validation_result) { described_class.new(params: valid_params).validate }

      it 'returns a success' do
        expect(validation_result).to be_success
      end

      it 'returns the validated params hash' do
        expect(validation_result.value!).to eq(valid_params)
      end
    end

    context 'when space_code is missing' do
      subject(:validation_result) { described_class.new(params: valid_params.except(:space_code)).validate }

      it 'returns a failure' do
        expect(validation_result).to be_failure
      end

      it 'includes :space_code in failure details' do
        expect(validation_result.failure).to include(space_code: ['is missing'])
      end
    end

    context 'when date is missing' do
      subject(:validation_result) { described_class.new(params: valid_params.except(:date)).validate }

      it 'returns a failure' do
        expect(validation_result).to be_failure
      end

      it 'includes :date in failure details' do
        expect(validation_result.failure).to include(date: ['is missing'])
      end
    end

    context 'when space_code is not a string' do
      subject(:validation_result) { described_class.new(params: valid_params.merge(space_code: 123)).validate }

      it 'returns a failure' do
        expect(validation_result).to be_failure
      end

      it 'includes :space_code type error in failure details' do
        expect(validation_result.failure).to include(space_code: ['must be a string'])
      end
    end

    context 'when date is not a Date object' do
      subject(:validation_result) { described_class.new(params: valid_params.merge(date: '2024-05-15')).validate }

      it 'returns a success (due to type coercion)' do
        expect(validation_result).to be_success
      end
    end

    context 'when space_code does not exist' do
      subject(:validation_result) { described_class.new(params: valid_params.merge(space_code: 'non-existent-space')).validate }

      it 'returns a failure' do
        expect(validation_result).to be_failure
      end

      it 'returns a specific :space_code not found error' do
        expect(validation_result.failure).to eq(space_code: "Not found")
      end
    end
  end

  describe '#call' do
    # Budgets for the 'test-space' in the current month
    subject(:returned_budgets) { query_call_result.value! }
    let!(:food_budget) { create(:budget, space: space, category: food_category, date: current_month_date, amount_cents: 10000) } # 100.00
    let!(:transport_budget) { create(:budget, space: space, category: transport_category, date: current_month_date, amount_cents: 5000) } # 50.00
    let!(:utilities_budget) { create(:budget, space: space, category: utilities_category, date: current_month_date, amount_cents: 7500) } # 75.00
    let!(:hobby_budget) { create(:budget, space: space, category: hobby_category, date: current_month_date, amount_cents: 3000) } # 30.00

    # Budgets for other scenarios
    let!(:food_budget_prev_month) { create(:budget, space: space, category: prev_month_food_category, date: prev_month_date, amount_cents: 8000) }
    let!(:food_budget_next_month) { create(:budget, space: space, category: food_category, date: next_month_date, amount_cents: 9000) }
    let!(:other_space_ent_budget) { create(:budget, space: other_space, category: other_space_category, date: current_month_date, amount_cents: 6000) }

    # Transactions
    # For food_budget (target: 50.00 spent)
    let!(:t1_food) { create(:expense_transaction, space: space, category: food_category, date: current_month_date, amount_cents: 3000, balance_state: 'calculated') }
    let!(:t2_food) { create(:expense_transaction, space: space, category: food_category, date: current_month_date, amount_cents: 2000, balance_state: 'calculated') }
    let!(:t3_food_pending) { create(:expense_transaction, space: space, category: food_category, date: current_month_date, amount_cents: 1000, balance_state: 'pending') }
    let!(:t4_food_prev_month) { create(:expense_transaction, space: space, category: food_category, date: prev_month_date, amount_cents: 500, balance_state: 'calculated') }

    # For transport_budget (target: 15.00 spent)
    let!(:t1_transport) { create(:expense_transaction, space: space, category: transport_category, date: current_month_date, amount_cents: 1500, balance_state: 'calculated') }

    # For hobby_budget (target: 0.00 spent as it's 'pending')
    let!(:t1_hobby_pending) { create(:expense_transaction, space: space, category: hobby_category, date: current_month_date, amount_cents: 1000, balance_state: 'pending') }

    # utilities_budget has no transactions

    let(:default_query_params) { { space_code: space.code, date: current_month_date } }

    let(:query_call_result) { described_class.new(params: query_params).call }



    context 'with valid space_code and date' do
      let(:query_params) { default_query_params }

      it 'succeeds' do
        expect(query_call_result).to be_success
      end

      # All budgets for the current month in the correct space should be returned
      it 'returns all budgets for the specified month and space' do
        expect(returned_budgets.map(&:id)).to contain_exactly(
          food_budget.id,
          transport_budget.id,
          utilities_budget.id,
          hobby_budget.id
        )
      end

      it 'returns the correct number of budgets' do
        expect(returned_budgets.to_a.size).to eq(4)
      end

      describe 'food budget data (with calculated transactions)' do
        subject(:budget_data) { returned_budgets.find { |b| b.id == food_budget.id } }

        it 'is present in the results' do
          expect(budget_data).not_to be_nil
        end

        it 'has the correct category_name' do
          expect(budget_data.category_name).to eq("Food")
        end

        it 'has the correct total_spent (sum of calculated transactions in month)' do
          expect(budget_data.total_spent).to eq(50.00) # 30.00 + 20.00
        end

        it 'retains original budget attributes' do
          expect(budget_data.amount_cents).to eq(food_budget.amount_cents)
        end
      end

      describe 'transport budget data (with one calculated transaction)' do
        subject(:budget_data) { returned_budgets.find { |b| b.id == transport_budget.id } }

        it 'is present in the results' do
          expect(budget_data).not_to be_nil
        end

        it 'has the correct category_name' do
          expect(budget_data.category_name).to eq("Transport")
        end

        it 'has the correct total_spent' do
          expect(budget_data.total_spent).to eq(15.00)
        end
      end

      describe 'utilities budget data (with no transactions)' do
        subject(:budget_data) { returned_budgets.find { |b| b.id == utilities_budget.id } }

        it 'is present in the results' do
          expect(budget_data).not_to be_nil
        end

        it 'has the correct category_name' do
          expect(budget_data.category_name).to eq("Utilities")
        end

        it 'has a total_spent of 0' do
          expect(budget_data.total_spent).to eq(0.00)
        end
      end

      describe 'hobby budget data (with only pending transactions)' do
        subject(:budget_data) { returned_budgets.find { |b| b.id == hobby_budget.id } }

        it 'is present in the results' do
          expect(budget_data).not_to be_nil
        end

        it 'has the correct category_name' do
          expect(budget_data.category_name).to eq("Hobbies")
        end

        it 'has a total_spent of 0' do
          expect(budget_data.total_spent).to eq(0.00)
        end
      end

      it 'excludes budgets from different months' do
        expect(returned_budgets.map(&:id)).not_to include(food_budget_prev_month.id, food_budget_next_month.id)
      end

      it 'excludes budgets from different spaces' do
        expect(returned_budgets.map(&:id)).not_to include(other_space_ent_budget.id)
      end
    end

    context 'when no budgets exist for the specified space' do
      let(:query_params) { { space_code: 'space-with-no-budgets', date: current_month_date } }
      let!(:empty_space) { create(:space, code: 'space-with-no-budgets') } # Ensure space exists for validation

      it 'succeeds' do
        expect(query_call_result).to be_success
      end

      it 'returns an empty array' do
        expect(returned_budgets).to be_empty
      end
    end

    context 'when no budgets exist for the specified date' do
      let(:query_params) { { space_code: space.code, date: Date.new(2000, 1, 1) } } # A date with no budgets

      it 'succeeds' do
        expect(query_call_result).to be_success
      end

      it 'returns an empty array' do
        expect(returned_budgets).to be_empty
      end
    end

    context 'when budgets exist but none have calculated transactions in the month' do
      let(:isolated_space) { create(:space) }
      let(:isolated_cat1) { create(:category, space: isolated_space, name: "Isolated Cat 1", category_type: :expense) }
      let(:isolated_cat2) { create(:category, space: isolated_space, name: "Isolated Cat 2", category_type: :expense) }

      before do
        create(:budget, space: isolated_space, category: isolated_cat1, date: current_month_date) # No transactions
        create(:budget, space: isolated_space, category: isolated_cat2, date: current_month_date)
        create(:expense_transaction, space: isolated_space, category: isolated_cat2, date: current_month_date, balance_state: 'pending')
        create(:expense_transaction, space: isolated_space, category: isolated_cat2, date: prev_month_date, balance_state: 'calculated')
      end

      let(:query_params) { { space_code: isolated_space.code, date: current_month_date } }
      let(:result) { described_class.new(params: query_params).call.value! }

      it 'succeeds' do
        expect(query_call_result).to be_success
      end

      it 'returns all the budgets for that month' do
        expect(result.to_a.size).to eq(2)
      end

      it 'returns total_spent as 0 for all budgets' do
        expect(result.map(&:total_spent)).to all(be_zero)
      end
    end
  end
end
