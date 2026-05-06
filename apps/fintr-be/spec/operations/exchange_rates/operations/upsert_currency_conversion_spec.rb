# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::Operations::UpsertCurrencyConversion do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let(:transaction) { create(:transaction, space:) }

  describe "#call" do
    context "when convertible has no currency_conversion" do
      it "creates a new CurrencyConversion and returns the convertible" do
        result = operation.call(
          convertible: transaction,
          space_id: space.id,
          original_amount: 100,
          original_currency: "USD",
          converted_amount: 5500,
          converted_currency: "PHP",
          exchange_rate: 55.0,
          source: "manual"
        )

        expect(result).to be_success
        expect(result.value!).to eq(transaction)
        transaction.reload
        expect(transaction.currency_conversion).to be_present
        expect(transaction.currency_conversion.original_currency).to eq("USD")
        expect(transaction.currency_conversion.converted_currency).to eq("PHP")
        expect(transaction.currency_conversion.exchange_rate).to eq(55.0)
        expect(transaction.currency_conversion.source).to eq("manual")
      end

      it "persists exchange_rate as converted/original even when the client sends a different value" do
        result = operation.call(
          convertible: transaction,
          space_id: space.id,
          original_amount: 6066.4,
          original_currency: "PHP",
          converted_amount: 100,
          converted_currency: "USD",
          exchange_rate: 60.664,
          source: "manual"
        )

        expect(result).to be_success
        transaction.reload
        expected = (BigDecimal("100") / BigDecimal("6066.4")).round(10).round(6)
        expect(transaction.currency_conversion.exchange_rate).to eq(expected)
      end
    end

    context "when convertible already has currency_conversion" do
      let!(:conversion) do
        ExchangeRates::CurrencyConversion.create!(
          convertible: transaction,
          space_id: space.id,
          original_amount_cents: 10_000,
          original_currency: "USD",
          converted_amount_cents: 550_000,
          converted_currency: "PHP",
          exchange_rate: 55.0,
          source: "manual",
          rate_timestamp: Time.current
        )
      end

      it "updates the existing CurrencyConversion and returns the convertible" do
        result = operation.call(
          convertible: transaction,
          space_id: space.id,
          original_amount: 200,
          original_currency: "USD",
          converted_amount: 11_000,
          converted_currency: "PHP",
          exchange_rate: 55.0,
          source: "auto"
        )

        expect(result).to be_success
        expect(result.value!).to eq(transaction)
        conversion.reload
        expect(conversion.original_amount_cents).to eq(20_000)
        expect(conversion.converted_amount_cents).to eq(1_100_000)
        expect(conversion.source).to eq("auto")
      end
    end

    context "when contract validation fails" do
      it "returns Failure when original_currency equals converted_currency" do
        result = operation.call(
          convertible: transaction,
          space_id: space.id,
          original_amount: 100,
          original_currency: "PHP",
          converted_amount: 100,
          converted_currency: "PHP",
          exchange_rate: 1.0,
          source: "manual"
        )

        expect(result).to be_failure
        expect(result.failure).to be_present
      end
    end
  end
end
