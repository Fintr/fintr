# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Queries::TotalsByType, type: :query do
  let!(:space) { create(:personal_space, code: 'test-space') }
  let!(:account1) { create(:account, space: space) }
  let!(:account2) { create(:account, space: space) }
  let!(:income_category) { create(:category, name: 'Salary', space: space, category_type: 'income') }
  let!(:expense_category) { create(:category, name: 'Food', space: space, category_type: 'expense') }

  let(:default_params) do
    {
      space_code: 'test-space',
      start_date: Date.new(2024, 1, 1),
      end_date: Date.new(2024, 1, 31)
    }
  end

  describe '#call' do
    context 'when validation fails' do
      it 'returns failure for missing space_code' do
        params = default_params.except(:space_code)
        result = described_class.call(params: params)

        expect(result).to be_failure
        expect(result.failure).to include(:space_code)
      end

      it 'returns failure for invalid space_code' do
        params = default_params.merge(space_code: 'non-existent')
        result = described_class.call(params: params)

        expect(result).to be_failure
        expect(result.failure).to include(:space_code)
      end

      it 'returns failure for missing start_date' do
        params = default_params.except(:start_date)
        result = described_class.call(params: params)

        expect(result).to be_failure
        expect(result.failure).to include(:start_date)
      end

      it 'returns failure for missing end_date' do
        params = default_params.except(:end_date)
        result = described_class.call(params: params)

        expect(result).to be_failure
        expect(result.failure).to include(:end_date)
      end
    end

    context 'with no transactions' do
      it 'returns zero totals' do
        result = described_class.call(params: default_params)

        expect(result).to be_success
        expect(result.value!).to eq({ income: 0.0, expense: 0.0, transfer: 0.0 })
      end
    end

    context 'with income transactions only' do
      let!(:income1) do
        create(:income_transaction,
               space: space,
               account: account1,
               category: income_category,
               date: Date.new(2024, 1, 10),
               amount_cents: 10000) # 100.00
      end

      let!(:income2) do
        create(:income_transaction,
               space: space,
               account: account1,
               category: income_category,
               date: Date.new(2024, 1, 15),
               amount_cents: 25000) # 250.00
      end

      it 'calculates income total correctly' do
        result = described_class.call(params: default_params)

        expect(result).to be_success
        totals = result.value!
        expect(totals[:income]).to eq(350.0)
        expect(totals[:expense]).to eq(0.0)
        expect(totals[:transfer]).to eq(0.0)
      end
    end

    context 'with expense transactions only' do
      let!(:expense1) do
        create(:expense_transaction,
               space: space,
               account: account1,
               category: expense_category,
               date: Date.new(2024, 1, 10),
               amount_cents: 5000) # 50.00
      end

      let!(:expense2) do
        create(:expense_transaction,
               space: space,
               account: account1,
               category: expense_category,
               date: Date.new(2024, 1, 20),
               amount_cents: 7500) # 75.00
      end

      it 'calculates expense total correctly' do
        result = described_class.call(params: default_params)

        expect(result).to be_success
        totals = result.value!
        expect(totals[:income]).to eq(0.0)
        expect(totals[:expense]).to eq(125.0)
        expect(totals[:transfer]).to eq(0.0)
      end
    end

    context 'with transfer transactions only' do
      let!(:transfer1) do
        create(:transfer,
               space: space,
               from_account: account1,
               to_account: account2,
               date: Date.new(2024, 1, 12),
               amount_cents: 3000) # 30.00
      end

      let!(:transfer2) do
        create(:transfer,
               space: space,
               from_account: account2,
               to_account: account1,
               date: Date.new(2024, 1, 18),
               amount_cents: 2000) # 20.00
      end

      it 'calculates transfer total correctly' do
        result = described_class.call(params: default_params)

        expect(result).to be_success
        totals = result.value!
        expect(totals[:income]).to eq(0.0)
        expect(totals[:expense]).to eq(0.0)
        expect(totals[:transfer]).to eq(50.0)
      end
    end

    context 'with mixed transaction types' do
      let!(:income) do
        create(:income_transaction,
               space: space,
               account: account1,
               category: income_category,
               date: Date.new(2024, 1, 5),
               amount_cents: 100000) # 1000.00
      end

      let!(:expense) do
        create(:expense_transaction,
               space: space,
               account: account1,
               category: expense_category,
               date: Date.new(2024, 1, 10),
               amount_cents: 25000) # 250.00
      end

      let!(:transfer) do
        create(:transfer,
               space: space,
               from_account: account1,
               to_account: account2,
               date: Date.new(2024, 1, 15),
               amount_cents: 10000) # 100.00
      end

      it 'calculates all totals correctly' do
        result = described_class.call(params: default_params)

        expect(result).to be_success
        totals = result.value!
        expect(totals[:income]).to eq(1000.0)
        expect(totals[:expense]).to eq(250.0)
        expect(totals[:transfer]).to eq(100.0)
      end
    end

    context 'with date filtering' do
      let!(:income_jan) do
        create(:income_transaction,
               space: space,
               account: account1,
               category: income_category,
               date: Date.new(2024, 1, 15),
               amount_cents: 10000)
      end

      let!(:income_feb) do
        create(:income_transaction,
               space: space,
               account: account1,
               category: income_category,
               date: Date.new(2024, 2, 15),
               amount_cents: 20000)
      end

      it 'only includes transactions within the date range' do
        result = described_class.call(params: default_params)

        expect(result).to be_success
        totals = result.value!
        expect(totals[:income]).to eq(100.0) # Only January income
      end
    end

    context 'with category filtering' do
      let!(:salary_category) { create(:category, name: 'SalaryFilter', space: space, category_type: 'income') }
      let!(:bonus_category) { create(:category, name: 'BonusFilter', space: space, category_type: 'income') }

      let!(:salary_income) do
        create(:income_transaction,
               space: space,
               account: account1,
               category: salary_category,
               date: Date.new(2024, 1, 10),
               amount_cents: 50000)
      end

      let!(:bonus_income) do
        create(:income_transaction,
               space: space,
               account: account1,
               category: bonus_category,
               date: Date.new(2024, 1, 15),
               amount_cents: 10000)
      end

      it 'filters by category when specified' do
        params = default_params.merge(category_name: 'SalaryFilter')
        result = described_class.call(params: params)

        expect(result).to be_success
        totals = result.value!
        expect(totals[:income]).to eq(500.0) # Only SalaryFilter category
      end

      it 'includes all categories when category_name is "all"' do
        params = default_params.merge(category_name: 'all')
        result = described_class.call(params: params)

        expect(result).to be_success
        totals = result.value!
        expect(totals[:income]).to eq(600.0) # Both Salary and Bonus
      end
    end

    context 'with account filtering' do
      let!(:checking_account) { create(:account, name: 'Checking', space: space) }
      let!(:savings_account) { create(:account, name: 'Savings', space: space) }

      let!(:income_checking) do
        create(:income_transaction,
               space: space,
               account: checking_account,
               category: income_category,
               date: Date.new(2024, 1, 10),
               amount_cents: 30000)
      end

      let!(:income_savings) do
        create(:income_transaction,
               space: space,
               account: savings_account,
               category: income_category,
               date: Date.new(2024, 1, 15),
               amount_cents: 20000)
      end

      it 'filters by account when specified' do
        params = default_params.merge(account_name: 'Checking')
        result = described_class.call(params: params)

        expect(result).to be_success
        totals = result.value!
        expect(totals[:income]).to eq(300.0) # Only Checking account
      end
    end

    context 'with different spaces' do
      let!(:other_space) { create(:personal_space, code: 'other-space') }
      let!(:other_account) { create(:account, space: other_space) }
      let!(:other_category) { create(:category, name: 'Other', space: other_space, category_type: 'income') }

      let!(:income_test_space) do
        create(:income_transaction,
               space: space,
               account: account1,
               category: income_category,
               date: Date.new(2024, 1, 10),
               amount_cents: 10000)
      end

      let!(:income_other_space) do
        create(:income_transaction,
               space: other_space,
               account: other_account,
               category: other_category,
               date: Date.new(2024, 1, 10),
               amount_cents: 50000)
      end

      it 'only includes transactions from the specified space' do
        result = described_class.call(params: default_params)

        expect(result).to be_success
        totals = result.value!
        expect(totals[:income]).to eq(100.0) # Only test-space income
      end
    end

    context "when an expense has currency_conversion with original in space currency" do
      let!(:usd_account) { create(:account, space: space, balance_currency: "USD", name: "USD") }
      let!(:expense_converted) do
        create(
          :expense_transaction,
          :one_time,
          space: space,
          account: usd_account,
          category: expense_category,
          date: Date.new(2024, 1, 5),
          amount: Money.from_amount(16.48, "PHP"),
          amount_currency: "PHP"
        )
      end

      before do
        ExchangeRates::CurrencyConversion.create!(
          convertible: expense_converted,
          space_id: space.id,
          original_amount_cents: 1000_00,
          original_currency: "PHP",
          converted_amount_cents: 1648,
          converted_currency: "USD",
          exchange_rate: 0.01648,
          source: "manual",
          rate_timestamp: Time.current
        )
      end

      it "counts the space-currency original as expense total magnitude" do
        result = described_class.call(params: default_params)

        expect(result).to be_success
        expect(result.value![:expense]).to eq(1000.0)
      end
    end

    context "when space is PHP and expenses are booked in USD with a cached rate" do
      let!(:php_space) { create(:personal_space, code: "php-usd-total-space", currency: "PHP") }
      let!(:usd_expense) do
        create(
          :expense_transaction,
          :one_time,
          space: php_space,
          account: usd_account,
          category: usd_expense_category,
          date: usd_rate_date,
          amount: Money.from_amount(100, "USD"),
          amount_currency: "USD"
        )
      end
      let!(:usd_account) { create(:account, space: php_space, balance_currency: "USD") }
      let!(:usd_expense_category) do
        create(:category, name: "FoodUsd", space: php_space, category_type: "expense")
      end
      let(:usd_rate_date) { Date.new(2024, 1, 12) }
      let(:usd_total_params) do
        {
          space_code: php_space.code,
          start_date: Date.new(2024, 1, 1),
          end_date: Date.new(2024, 1, 31)
        }
      end

      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
          target_currency: "PHP",
          rate: 56.0,
          rate_date: usd_rate_date
        )
      end


      it "sums expense totals in space currency (converted PHP), not raw USD numerals" do
        result = described_class.call(params: usd_total_params)

        expect(result).to be_success
        expect(result.value![:expense]).to eq(5600.0)
      end
    end
  end
end
