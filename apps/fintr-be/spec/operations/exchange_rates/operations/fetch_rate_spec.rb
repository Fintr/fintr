# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::Operations::FetchRate do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:date) { Date.new(2026, 6, 25) }

  describe "#call" do
    context "when cached base rates exist for the requested date" do
      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date,
          rate: 57.9
        )
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "EUR",
          rate_date: date,
          rate: 0.92
        )

        allow(ExchangeRates::ApiExchangeRate).to receive(:sparse_snapshot_for_date?)
          .with(date: date)
          .and_return(false)
      end

      it "returns the cached cross rate without calling the external API" do
        expect(Integrations::ExchangeRates::Client).not_to receive(:fetch_rates_from_base)

        result = operation.call(
          from_currency: "EUR",
          to_currency: "PHP",
          date: date
        )

        expect(result).to be_success
        expect(result.value![:source]).to eq("api")
        expect(result.value![:rate]).to be_within(0.0001).of(57.9 / 0.92)
      end

      it "matches cached rates regardless of currency casing" do
        expect(Integrations::ExchangeRates::Client).not_to receive(:fetch_rates_from_base)

        result = operation.call(
          from_currency: "usd",
          to_currency: "php",
          date: date
        )

        expect(result).to be_success
        expect(result.value![:rate]).to eq(57.9)
      end
    end

    context "when cached rates are missing for the requested date" do
      it "fetches only missing targets from the external API" do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date,
          rate: 57.9
        )

        api_rates = { "EUR" => 0.92, "SSP" => 4_800.0 }

        allow(Integrations::ExchangeRates::Client).to receive(:fetch_rates_from_base)
          .with(base: "USD", date: date)
          .and_return(api_rates)

        expect do
          result = operation.call(
            from_currency: "EUR",
            to_currency: "PHP",
            date: date
          )

          expect(result).to be_success
          expect(result.value![:rate]).to be_within(0.0001).of(57.9 / 0.92)
        end.to have_enqueued_job(ExchangeRates::PersistDailyApiRatesJob)
          .with(date: date.to_s, rates: api_rates)
      end

      it "does not enqueue duplicate jobs for the same date" do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date,
          rate: 57.9
        )

        api_rates = { "EUR" => 0.92, "SSP" => 4_800.0 }

        allow(Integrations::ExchangeRates::Client).to receive(:fetch_rates_from_base)
          .with(base: "USD", date: date)
          .and_return(api_rates)
          .twice

        allow(ExchangeRates::PersistDailyApiRatesJob).to receive(:pending_for_date?)
          .and_return(false, true)

        expect(ExchangeRates::PersistDailyApiRatesJob).to receive(:perform_later)
          .with(date: date.to_s, rates: api_rates)
          .once

        operation.call(
          from_currency: "EUR",
          to_currency: "PHP",
          date: date
        )
        operation.call(
          from_currency: "EUR",
          to_currency: "SSP",
          date: date
        )
      end

      it "falls back to the latest cached rate when the external API fetch fails" do
        older_date = Date.new(2026, 4, 28)

        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: Date.new(2026, 3, 18),
          rate: 58.0
        )
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "SSP",
          rate_date: Date.new(2026, 3, 18),
          rate: 4_800.0
        )

        allow(Integrations::ExchangeRates::Client).to receive(:fetch_rates_from_base)
          .with(base: "USD", date: older_date)
          .and_raise(StandardError, "API unavailable")

        result = operation.call(
          from_currency: "PHP",
          to_currency: "SSP",
          date: older_date
        )

        expect(result).to be_success
        expect(result.value![:source]).to eq("recent_cached")
        expect(result.value![:rate]).to be_within(0.0001).of(4_800.0 / 58.0)
      end
    end

    context "when the day only has a partial cached snapshot" do
      let(:partial_date) { Date.new(2026, 4, 28) }

      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "EUR",
          rate_date: partial_date,
          rate: 0.92
        )
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: "USD",
          target_currency: "SSP",
          rate_date: partial_date,
          rate: 4_800.0
        )
      end

      it "returns the cached cross rate without enqueueing a backfill job" do
        expect(Integrations::ExchangeRates::Client).not_to receive(:fetch_rates_from_base)

        expect do
          result = operation.call(
            from_currency: "EUR",
            to_currency: "SSP",
            date: partial_date
          )

          expect(result).to be_success
          expect(result.value![:source]).to eq("api")
          expect(result.value![:rate]).to be_within(0.0001).of(4_800.0 / 0.92)
        end.not_to have_enqueued_job(ExchangeRates::PersistDailyApiRatesJob)
      end
    end
  end
end
