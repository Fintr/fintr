# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::PersistDailyApiRatesJob, type: :job do
  let(:date) { Date.new(2026, 4, 28) }

  describe "concurrency controls" do
    it "limits concurrent executions to one per date" do
      expect(described_class.concurrency_limit).to eq(1)
      expect(described_class.concurrency_key.call(date: date.to_s)).to eq(
        "exchange_rates/persist_daily/#{date}"
      )
    end
  end

  describe ".enqueue_for_date" do
    let(:rates) { { "PHP" => 58.0, "SSP" => 4_800.0, "EUR" => 0.92 } }

    it "does not enqueue when rates are blank" do
      expect do
        expect(described_class.enqueue_for_date(date:, rates: {})).to be(false)
      end.not_to have_enqueued_job(described_class)
    end

    it "does not enqueue when a full snapshot already exists for the date" do
      stub_const(
        "ExchangeRates::ApiExchangeRate::FULL_SNAPSHOT_MIN_TARGET_COUNT",
        2
      )
      ExchangeRates::ApiExchangeRate.create!(
        base_currency: "USD",
        target_currency: "PHP",
        rate_date: date,
        rate: 58.0
      )
      ExchangeRates::ApiExchangeRate.create!(
        base_currency: "USD",
        target_currency: "SSP",
        rate_date: date,
        rate: 4_800.0
      )

      expect do
        expect(described_class.enqueue_for_date(date:, rates:)).to be(false)
      end.not_to have_enqueued_job(described_class)
    end

    it "does not enqueue a second job while one is already pending for the date" do
      allow(described_class).to receive(:pending_for_date?)
        .with(date.to_s)
        .and_return(true)

      expect do
        expect(described_class.enqueue_for_date(date:, rates:)).to be(true)
      end.not_to have_enqueued_job(described_class)
    end

    it "enqueues a single job when the snapshot is incomplete and none is pending" do
      allow(described_class).to receive(:pending_for_date?)
        .with(date.to_s)
        .and_return(false)

      expect do
        expect(described_class.enqueue_for_date(date:, rates:)).to be(true)
      end.to have_enqueued_job(described_class)
        .with(date: date.to_s, rates: rates)
    end
  end

  describe "#perform" do
    it "persists every rate in the snapshot for the date" do
      described_class.perform_now(
        date: date.to_s,
        rates: {
          "PHP" => 58.0,
          "SSP" => 4_800.0,
          "EUR" => 0.92
        }
      )

      expect(
        ExchangeRates::ApiExchangeRate.find_by(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date
        )&.rate
      ).to eq(58.0)
      expect(
        ExchangeRates::ApiExchangeRate.find_by(
          base_currency: "USD",
          target_currency: "SSP",
          rate_date: date
        )&.rate
      ).to eq(4_800.0)
      expect(
        ExchangeRates::ApiExchangeRate.find_by(
          base_currency: "USD",
          target_currency: "EUR",
          rate_date: date
        )&.rate
      ).to eq(0.92)
    end

    it "fetches from the API and persists when rates are not provided" do
      api_rates = { "PHP" => 58.0, "SSP" => 4_800.0, "EUR" => 0.92 }

      allow(Integrations::ExchangeRates::Client).to receive(:fetch_rates_from_base)
        .with(base: "USD", date: date)
        .and_return(api_rates)

      described_class.perform_now(date: date.to_s)

      expect(
        ExchangeRates::ApiExchangeRate.find_by(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date
        )&.rate
      ).to eq(58.0)
      expect(
        ExchangeRates::ApiExchangeRate.where(
          base_currency: "USD",
          rate_date: date
        ).count
      ).to eq(3)
    end
  end
end
