# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::Operations::PersistApiRates do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:date) { Date.new(2026, 6, 25) }

  describe "#call" do
    it "creates rates for each target currency" do
      result = operation.call(
        rates: { "PHP" => 57.9, "EUR" => 0.92 },
        date: date
      )

      expect(result).to be_success
      expect(result.value!).to eq(2)
      expect(
        ExchangeRates::ApiExchangeRate.find_by(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date
        )&.rate
      ).to eq(57.9)
    end

    it "updates an existing rate for the same currency pair and date" do
      ExchangeRates::ApiExchangeRate.create!(
        base_currency: "USD",
        target_currency: "PHP",
        rate_date: date,
        rate: 55.0
      )

      result = operation.call(
        rates: { "PHP" => 57.9 },
        date: date
      )

      expect(result).to be_success
      expect(
        ExchangeRates::ApiExchangeRate.where(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date
        ).count
      ).to eq(1)
      expect(
        ExchangeRates::ApiExchangeRate.find_by(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date
        ).rate
      ).to eq(57.9)
    end

    it "does not raise when concurrent writes race on the same pair" do
      ExchangeRates::ApiExchangeRate.create!(
        base_currency: "USD",
        target_currency: "PHP",
        rate_date: date,
        rate: 55.0
      )

      racing_record = ExchangeRates::ApiExchangeRate.new(
        base_currency: "USD",
        target_currency: "PHP",
        rate_date: date,
        rate: 57.9
      )

      allow(ExchangeRates::ApiExchangeRate).to receive(:find_or_initialize_by).and_call_original
      allow(ExchangeRates::ApiExchangeRate).to receive(:find_or_initialize_by)
        .with(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date
        )
        .and_return(racing_record)

      allow(racing_record).to receive(:save!).and_raise(
        ActiveRecord::RecordNotUnique.new("duplicate key value")
      )

      expect do
        operation.call(
          rates: { "PHP" => 57.9 },
          date: date
        )
      end.not_to raise_error

      expect(
        ExchangeRates::ApiExchangeRate.find_by(
          base_currency: "USD",
          target_currency: "PHP",
          rate_date: date
        ).rate
      ).to eq(57.9)
    end
  end
end
