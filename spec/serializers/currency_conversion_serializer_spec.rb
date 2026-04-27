# frozen_string_literal: true

require "rails_helper"

RSpec.describe CurrencyConversionSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(conversion) }

  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space: space) }
  let(:transaction) { create(:transaction, space: space, account: account) }
  let(:conversion) do
    ExchangeRates::CurrencyConversion.create!(
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

  it "serializes exchange_rate as the forward multiplier from amounts when the column is wrong" do
    expected = (BigDecimal("100") / BigDecimal("6066.4")).round(10).to_f
    expect(serialized_hash[:exchange_rate]).to eq(expected)
  end
end
