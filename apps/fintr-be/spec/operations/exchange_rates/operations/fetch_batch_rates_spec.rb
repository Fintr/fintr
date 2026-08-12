# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::Operations::FetchBatchRates do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:date) { Date.new(2026, 8, 12) }
  let(:mock_fetch_rate) { instance_double(ExchangeRates::Operations::FetchRate) }

  before do
    allow(ExchangeRates::Operations::FetchRate).to receive(:new).and_return(mock_fetch_rate)
  end

  describe "#call" do
    it "returns rates for each requested pair and date" do
      allow(mock_fetch_rate).to receive(:call).and_return(
        Dry::Monads::Success(
          rate: 76.4,
          source: "api",
          from_currency: "GBP",
          to_currency: "PHP",
          timestamp: Time.current
        )
      )

      result = operation.call(
        requests: [
          { from_currency: "GBP", to_currency: "PHP", date: date },
          { from_currency: "AUD", to_currency: "PHP", date: date }
        ],
        space_id: "space-1"
      )

      expect(result).to be_success
      payload = result.value!
      expect(payload[:rates].length).to eq(2)
      expect(payload[:rates].map { |row| row[:from_currency] }).to contain_exactly("GBP", "AUD")
      expect(payload[:errors]).to eq([])
    end

    it "collects per-request failures without aborting the batch" do
      allow(mock_fetch_rate).to receive(:call).and_return(
        Dry::Monads::Success(
          rate: 38.5,
          source: "api",
          from_currency: "AUD",
          to_currency: "PHP",
          timestamp: Time.current
        ),
        Dry::Monads::Failure(message: "Rate not found")
      )

      result = operation.call(
        requests: [
          { from_currency: "AUD", to_currency: "PHP", date: date },
          { from_currency: "ZZZ", to_currency: "PHP", date: date }
        ]
      )

      expect(result).to be_success
      payload = result.value!
      expect(payload[:rates].length).to eq(1)
      expect(payload[:errors].length).to eq(1)
      expect(payload[:errors].first[:from_currency]).to eq("ZZZ")
      expect(payload[:errors].first[:message]).to eq("Rate not found")
    end

    it "fails validation when a request is missing required fields" do
      result = operation.call(
        requests: [
          { to_currency: "PHP", date: date }
        ]
      )

      expect(result).to be_failure
    end
  end
end
