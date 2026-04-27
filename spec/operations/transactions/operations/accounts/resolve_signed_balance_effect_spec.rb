# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Accounts::ResolveSignedBalanceEffect do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space:, balance: Money.from_amount(1000, "PHP")) }
  let(:category) { create(:category, space:, category_type: "income", name: "Salary") }

  describe "#call" do
    context "when transaction has a persisted currency_conversion in account currency" do
      let(:transaction) do
        create(
          :transaction,
          user:,
          space:,
          account:,
          category:,
          amount: Money.from_amount(5500, "PHP")
        )
      end

      before do
        ExchangeRates::CurrencyConversion.create!(
          convertible: transaction,
          space_id: space.id,
          original_amount_cents: 100_00,
          original_currency: "USD",
          converted_amount_cents: 5500_00,
          converted_currency: "PHP",
          exchange_rate: 55.0,
          source: "manual",
          rate_timestamp: Time.current
        )
        transaction.reload
      end

      it "uses transaction.value.amount without calling FetchRate" do
        expect(ExchangeRates::Operations::FetchRate).not_to receive(:new)

        result = operation.call(transaction:, account:)

        expect(result).to be_success
        expect(result.value![:amount]).to eq(BigDecimal("5500"))
      end
    end

    context "when there is no currency_conversion and currencies match" do
      let(:transaction) do
        create(
          :transaction,
          user:,
          space:,
          account:,
          category:,
          amount: Money.from_amount(200, "PHP")
        )
      end

      it "returns the signed amount via ConvertSignedAmount same-currency path" do
        result = operation.call(transaction:, account:)

        expect(result).to be_success
        expect(result.value![:amount]).to eq(BigDecimal("200"))
      end
    end

    context "when there is no currency_conversion and currencies differ" do
      let(:usd_account) { create(:account, space:, balance: Money.from_amount(1000, "USD")) }
      let(:transaction) do
        create(
          :transaction,
          user:,
          space:,
          account: usd_account,
          category:,
          amount: Money.from_amount(5800, "PHP")
        )
      end

      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
          target_currency: "PHP",
          rate: 58,
          rate_date: transaction.date.to_date
        )
      end

      it "delegates to ConvertSignedAmount with FetchRate" do
        result = operation.call(transaction:, account: usd_account)

        expect(result).to be_success
        expected = (BigDecimal("5800") / BigDecimal("58")).round(2)
        expect(result.value![:amount]).to eq(expected)
      end
    end

    context "with optional rate_date" do
      let(:usd_account) { create(:account, space:, balance: Money.from_amount(1000, "USD")) }
      let(:transaction) do
        create(
          :transaction,
          user:,
          space:,
          account: usd_account,
          category:,
          amount: Money.from_amount(100, "PHP")
        )
      end

      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
          target_currency: "PHP",
          rate: 58,
          rate_date: Date.new(2026, 6, 1)
        )
      end

      it "uses rate_date for FetchRate when supplied" do
        result = operation.call(
          transaction:,
          account: usd_account,
          rate_date: Date.new(2026, 6, 1)
        )

        expect(result).to be_success
        expect(result.value![:amount]).to eq((BigDecimal("100") / BigDecimal("58")).round(2))
      end
    end
  end
end
