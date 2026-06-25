# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::Operations::FetchRatesFromApi do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:date) { Date.new(2026, 4, 28) }

  describe "#call" do
    context "when target currencies are provided and some are missing for the date" do
      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date,
          rate: 58.0
        )
      end

      it "returns the full API snapshot, not only the missing targets" do
        allow(Integrations::ExchangeRates::Client).to receive(:fetch_rates_from_base)
          .with(base: "USD", date: date)
          .and_return(
            "PHP" => 58.0,
            "SSP" => 4_800.0,
            "EUR" => 0.92
          )

        result = operation.call(
          base_currency: "USD",
          date: date,
          target_currencies: %w[SSP EUR]
        )

        expect(result).to be_success
        expect(result.value!).to eq(
          "PHP" => 58.0,
          "SSP" => 4_800.0,
          "EUR" => 0.92
        )
      end
    end
  end
end
