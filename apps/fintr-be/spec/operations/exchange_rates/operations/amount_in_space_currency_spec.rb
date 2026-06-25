# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::Operations::AmountInSpaceCurrency do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:space) { create(:personal_space, currency: "PHP") }
  let(:rate_date) { Date.new(2024, 6, 1) }

  describe "#call" do
    context "when strict is true and no FX is available for USD to PHP" do
      it "returns failure instead of a foreign-currency fallback" do
        result = operation.call(
          amount: BigDecimal("100"),
          amount_currency: "USD",
          date: rate_date,
          space: space,
          strict: true
        )

        expect(result).to be_failure
      end
    end

    context "when strict is true and a cached USD to PHP rate exists" do
      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
          target_currency: "PHP",
          rate: 55.5,
          rate_date: rate_date
        )
      end

      it "returns amount and currency in space terms" do
        result = operation.call(
          amount: BigDecimal("10"),
          amount_currency: "USD",
          date: rate_date,
          space: space,
          strict: true
        )

        expect(result).to be_success
        expect(result.value![:currency]).to eq("PHP")
        expect(result.value![:amount]).to eq(BigDecimal("555.0"))
      end
    end

    context "when strict is false and no FX is available" do
      it "falls back to the booked amount and currency" do
        result = operation.call(
          amount: BigDecimal("100"),
          amount_currency: "USD",
          date: rate_date,
          space: space,
          strict: false
        )

        expect(result).to be_success
        expect(result.value![:currency]).to eq("USD")
        expect(result.value![:amount]).to eq(BigDecimal("100"))
      end
    end

    context "when strict is false, the requested date has no rate, and a latest rate exists" do
      let(:space) { create(:personal_space, currency: "SSP") }
      let(:missing_date) { Date.new(2026, 4, 28) }

      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
          target_currency: "PHP",
          rate: 58.0,
          rate_date: Date.new(2026, 3, 18)
        )
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
          target_currency: "SSP",
          rate: 4_800.0,
          rate_date: Date.new(2026, 3, 18)
        )
      end

      it "converts using the latest cached cross rate in space currency" do
        result = operation.call(
          amount: BigDecimal("1500"),
          amount_currency: "PHP",
          date: missing_date,
          space: space,
          strict: false
        )

        expect(result).to be_success
        expect(result.value![:currency]).to eq("SSP")
        expect(result.value![:amount]).to eq(
          (BigDecimal("1500") * (BigDecimal("4800") / BigDecimal("58"))).round(2)
        )
      end
    end
  end
end
