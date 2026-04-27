# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::CurrencyConversion, type: :model do
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space: space) }
  let(:transaction) { create(:transaction, space: space, account: account) }

  describe "#exchange_rate_as_multiplier" do
    it "returns converted / original so UI can use original * rate = converted" do
      conversion = described_class.create!(
        convertible: transaction,
        space_id: space.id,
        original_amount_cents: 606_640,
        original_currency: "PHP",
        converted_amount_cents: 10_000,
        converted_currency: "USD",
        exchange_rate: 60.664,
        source: "manual",
        rate_timestamp: Time.current
      )

      expected = (BigDecimal("100") / BigDecimal("6066.4")).round(10)
      expect(conversion.exchange_rate_as_multiplier).to eq(expected)
    end
  end

  describe "#multiplier" do
    let(:conversion) do
      described_class.create!(
        convertible: transaction,
        space_id: space.id,
        original_amount_cents: 606_640,
        original_currency: "PHP",
        converted_amount_cents: 10_000,
        converted_currency: "USD",
        exchange_rate: 60.664,
        source: "manual",
        rate_timestamp: Time.current
      )
    end

    let(:forward) { (BigDecimal("100") / BigDecimal("6066.4")).round(10) }

    it "returns converted/original when (from, to) matches the stored leg" do
      expect(
        conversion.multiplier(from_currency: "PHP", to_currency: "USD")
      ).to eq(forward)
    end

    it "returns the reciprocal when (from, to) is the reverse leg" do
      expect(
        conversion.multiplier(from_currency: "USD", to_currency: "PHP")
      ).to eq((BigDecimal("1") / forward).round(10))
    end

    it "returns nil when the pair is not this row's leg" do
      expect(
        conversion.multiplier(from_currency: "EUR", to_currency: "USD")
      ).to be_nil
    end

    it "returns nil when from and to are the same" do
      expect(
        conversion.multiplier(from_currency: "PHP", to_currency: "PHP")
      ).to be_nil
    end
  end
end
