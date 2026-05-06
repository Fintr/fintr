# frozen_string_literal: true

require "rails_helper"

RSpec.describe Insights::Queries::MonthlySpending, type: :query do
  subject(:query_call_result) { described_class.new(params: query_params).call }

  let!(:space) { create(:space) }
  let!(:other_space) { create(:space) }

  let!(:income_category) { create(:category, space: space, name: "Salary", category_type: :income) }
  let!(:expense_category) { create(:category, space: space, name: "Rent", category_type: :expense) }
  let!(:initial_balance_category) { create(:category, space: space, name: "Initial Balance", category_type: :income) }

  let(:current_date) { Date.new(2024, 7, 15) }
  let(:start_of_month) { current_date.beginning_of_month }
  let(:end_of_month) { current_date.end_of_month }

  # Transactions for the current month in the main space
  let!(:income_current_month) do
    create(:income_transaction, space: space, category: income_category, date: start_of_month + 5.days, amount_cents: 50000, amount_currency: "USD", balance_state: :calculated)
  end
  let!(:expense_current_month) do
    create(:expense_transaction, space: space, category: expense_category, date: start_of_month + 10.days, amount_cents: 20000, amount_currency: "USD", balance_state: :calculated)
  end
  let!(:initial_balance_transaction) do
    create(:income_transaction, space: space, category: initial_balance_category, date: start_of_month, amount_cents: 100000, amount_currency: "USD", balance_state: :calculated)
  end
  let!(:pending_transaction) do
    create(:expense_transaction, space: space, category: expense_category, date: start_of_month + 1.day, amount_cents: 5000, amount_currency: "USD", balance_state: :pending)
  end

  # Transactions from previous month
  let!(:income_previous_month) do
    create(:income_transaction, space: space, category: income_category, date: start_of_month.prev_month + 5.days, amount_cents: 30000, amount_currency: "USD", balance_state: :calculated)
  end

  # Transactions from other space
  let!(:expense_other_space) do
    create(:expense_transaction, space: other_space, category: expense_category, date: start_of_month + 5.days, amount_cents: 10000, amount_currency: "USD", balance_state: :calculated)
  end

  let(:query_params) { { space_id: space.id, date_from: current_date } }


  describe "#validate" do
    context "when valid params" do
      it "returns a successful result" do
        expect(described_class.new(params: query_params).validate(params: query_params)).to be_success
      end

      it "returns the validated params in hash" do
        expect(described_class.new(params: query_params).validate(params: query_params).value!).to eq(query_params)
      end
    end

    context "when invalid params" do
      it "returns a failure result when space_id is missing" do
        invalid_params = query_params.except(:space_id)
        result = described_class.new(params: invalid_params).validate(params: invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(space_id: ["is missing"])
      end

      it "returns a failure result when date_from is missing" do
        invalid_params = query_params.except(:date_from)
        result = described_class.new(params: invalid_params).validate(params: invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(date_from: ["is missing"])
      end

      it "returns a failure result when space_id is not a string" do
        invalid_params = query_params.merge(space_id: 123)
        result = described_class.new(params: invalid_params).validate(params: invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(space_id: ["must be a string"])
      end

      it "returns a failure result when date_from is not a date" do
        invalid_params = query_params.merge(date_from: "not-a-date")
        result = described_class.new(params: invalid_params).validate(params: invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(date_from: ["must be a date"])
      end
    end
  end

  describe "#call" do
    context "with valid parameters and existing transactions" do
      it "succeeds" do
        expect(query_call_result).to be_success
      end

      it "returns monthly spending data" do
        result = query_call_result.value!
        expect(result).to be_an(ActiveRecord::Relation)
        expect(result.to_a.size).to eq(1) # Should only have data for the current month

        monthly_data = result.first # Access the first ActiveRecord object
        expect(monthly_data.month_year.to_date).to eq(start_of_month)
        expect(monthly_data.total_income).to eq(500.00) # Only calculated income, excluding initial balance
        expect(monthly_data.total_expense).to eq(200.00) # Only calculated expense
        expect(monthly_data.net_amount).to eq(300.00) # Income - Expense
        expect(monthly_data.amount_currency).to eq("USD")
      end

      it "filters by calculated state" do
        result = query_call_result.value!
        # Pending transaction should not be included in sums
        expect(result.first.total_expense).to eq(200.00)
      end

      it "excludes initial balance transactions" do
        result = query_call_result.value!
        expect(result.first.total_income).to eq(500.00)
      end

      it "filters by date and includes data up to end of current month" do
        # Create a transaction for later in the current month
        create(:income_transaction, space: space, category: income_category, date: end_of_month, amount_cents: 10000, amount_currency: "USD", balance_state: :calculated)
        result = described_class.new(params: query_params).call.value!

        expect(result.first.total_income).to eq(600.00) # 500 (initial) + 100 (new)
      end

      it "groups by month and currency" do
        # Create another transaction in the same month but different currency (if applicable, though currency might be fixed)
        # For now, assume single currency
        expect(query_call_result.value!.to_a.size).to eq(1)
      end

      it "orders by month_year ascending" do
        # Create a transaction for a previous month to test ordering
        create(:income_transaction, space: space, category: income_category, date: start_of_month.prev_month + 1.day, amount_cents: 10000, amount_currency: "USD", balance_state: :calculated)
        result = described_class.new(params: { space_id: space.id, date_from: start_of_month.prev_month }).call.value!
        expect(result.map { |r| r.month_year.to_date }).to eq([start_of_month.prev_month, start_of_month])
      end
    end

    context "when no transactions exist for the specified criteria" do
      # This context name will be changed to reflect the actual scenario
      # where no transactions exist for the *space* specified in query_params.
      let!(:space_without_transactions_for_criteria) { create(:space) }
      let(:query_params) { { space_id: space_without_transactions_for_criteria.id, date_from: Date.new(2000, 1, 1) } }

      it "returns an empty result when no transactions exist for the space" do
        expect(query_call_result).to be_success
        expect(query_call_result.value!).to be_empty
      end
    end

    context "when validation fails" do
      let(:query_params) { { space_id: nil, date_from: current_date } }

      it "returns a failure result with validation errors" do
        expect(query_call_result).to be_failure
        expect(query_call_result.failure).to include(space_id: ["must be a string"])
      end
    end
  end
end
