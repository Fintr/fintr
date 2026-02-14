# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::Operations::GetRecentRates do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }

  describe "#call" do
    context "when no conversions exist for the pair" do
      it "returns success with an empty array" do
        result = operation.call(
          space_id: space.id,
          from_currency: "USD",
          to_currency: "PHP"
        )

        expect(result).to be_success
        expect(result.value!).to eq([])
      end
    end

    context "when conversions exist for the pair" do
      let(:account) { create(:account, space:, balance: Money.from_amount(100, "PHP")) }
      let(:transaction) { create(:transaction, space:, account:) }

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
          rate_timestamp: 1.hour.ago
        )
      end

      it "returns success with recent rates" do
        result = operation.call(
          space_id: space.id,
          from_currency: "USD",
          to_currency: "PHP"
        )

        expect(result).to be_success
        rates = result.value!
        expect(rates.size).to eq(1)
        expect(rates.first).to include(rate: 55.0, source: "recent")
        expect(rates.first).to have_key(:timestamp)
      end
    end

    context "when contract validation fails" do
      it "returns Failure when from_currency is missing" do
        result = operation.call(
          space_id: space.id,
          from_currency: nil,
          to_currency: "PHP"
        )

        expect(result).to be_failure
        expect(result.failure).to have_key(:from_currency)
      end
    end
  end
end
