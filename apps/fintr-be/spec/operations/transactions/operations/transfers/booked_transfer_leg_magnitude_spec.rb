# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Transfers::BookedTransferLegMagnitude do
  include Dry::Monads[:result]

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:rate_date) { Date.new(2026, 1, 10) }

  describe ".debit_magnitude / .credit_magnitude" do
    context "when both accounts share USD but amount_currency was mislabeled as PHP (legacy)" do
      let(:from_usd) do
        create(
          :account,
          space:,
          name: "From USD",
          balance: Money.from_amount(1000, "USD"),
          balance_currency: "USD"
        )
      end
      let(:to_usd) do
        create(
          :account,
          space:,
          name: "To USD",
          balance: Money.from_amount(500, "USD"),
          balance_currency: "USD"
        )
      end
      let(:transfer) do
        t = Transactions::Transfer.new(
          user:,
          space:,
          from_account: from_usd,
          to_account: to_usd,
          amount_cents: 100_00,
          amount_currency: "PHP",
          transaction_cost_cents: 0,
          transaction_cost_currency: "PHP",
          date: rate_date,
          balance_state: "pending",
          schedule_type: "one_time",
          schedule: {},
          description: "Mislabeled currency"
        )
        t.save!(validate: false)
        t
      end

      it "treats the stored numeric as USD for the from leg without calling FetchRate" do
        expect(ExchangeRates::Operations::FetchRate).not_to receive(:new)

        result = described_class.debit_magnitude(
          transfer:,
          account: from_usd,
          rate_date:
        )

        expect(result).to be_success
        expect(result.value!).to eq(BigDecimal("100"))
      end

      it "treats the stored numeric as USD for the to leg without calling FetchRate" do
        expect(ExchangeRates::Operations::FetchRate).not_to receive(:new)

        result = described_class.credit_magnitude(
          transfer:,
          account: to_usd,
          rate_date:
        )

        expect(result).to be_success
        expect(result.value!).to eq(BigDecimal("100"))
      end
    end
  end
end
