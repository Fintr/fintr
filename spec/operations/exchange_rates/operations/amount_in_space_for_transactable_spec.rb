# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::Operations::AmountInSpaceForTransactable do
  include Dry::Monads[:result]

  let(:space) { create(:personal_space, currency: "PHP") }
  let!(:usd_account) { create(:account, space: space, balance_currency: "USD") }
  let!(:category) { create(:category, space: space, category_type: "expense", name: "Food") }
  let(:rate_date) { Date.new(2024, 3, 1) }

  describe ".display_payload" do
    context "when a cached USD to PHP rate exists" do
      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
          target_currency: "PHP",
          rate: 50.0,
          rate_date: rate_date
        )
      end

      let!(:expense) do
        create(
          :expense_transaction,
          :one_time,
          space: space,
          account: usd_account,
          category: category,
          date: rate_date,
          amount: Money.from_amount(10, "USD"),
          amount_currency: "USD"
        )
      end

      it "returns converted space currency and code" do
        payload = described_class.display_payload(transactable: expense)

        expect(payload[:currency]).to eq("PHP")
        expect(payload[:amount]).to eq(500.0)
      end
    end
  end

  describe "currency_conversion with original in space currency" do
    let!(:expense_converted) do
      create(
        :expense_transaction,
        :one_time,
        space: space,
        account: usd_account,
        category: category,
        date: rate_date,
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
      expense_converted.reload
    end

    it "returns the signed original space amount for display" do
      payload = described_class.display_payload(transactable: expense_converted)

      expect(payload[:currency]).to eq("PHP")
      expect(payload[:amount]).to eq(-1000.0)
    end

    it "returns the same signed amount for totals" do
      expect(described_class.totals_amount_decimal(transactable: expense_converted)).to eq(-1000.0)
    end
  end

  describe ".totals_amount_decimal" do
    context "when a cached USD to PHP rate exists" do
      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
          target_currency: "PHP",
          rate: 50.0,
          rate_date: rate_date
        )
      end

      let!(:expense) do
        create(
          :expense_transaction,
          :one_time,
          space: space,
          account: usd_account,
          category: category,
          date: rate_date,
          amount: Money.from_amount(10, "USD"),
          amount_currency: "USD"
        )
      end

      it "returns the signed space amount as a decimal for summing" do
        expect(described_class.totals_amount_decimal(transactable: expense)).to eq(500.0)
      end
    end
  end
end
