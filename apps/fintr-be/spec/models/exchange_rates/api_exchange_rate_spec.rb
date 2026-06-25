# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::ApiExchangeRate do
  let(:date) { Date.new(2026, 4, 28) }

  describe ".sparse_snapshot_for_date?" do
    it "returns true when fewer than a full snapshot of targets are cached" do
      described_class.create!(
        base_currency: "USD",
        target_currency: "PHP",
        rate_date: date,
        rate: 58.0
      )
      described_class.create!(
        base_currency: "USD",
        target_currency: "SSP",
        rate_date: date,
        rate: 4_800.0
      )

      expect(described_class.sparse_snapshot_for_date?(date:)).to be(true)
    end

    it "returns false when a full snapshot of targets is cached" do
      allow(described_class).to receive(:cached_target_count_for_date)
        .with(date: date)
        .and_return(described_class::FULL_SNAPSHOT_MIN_TARGET_COUNT)

      expect(described_class.sparse_snapshot_for_date?(date:)).to be(false)
    end
  end
end
