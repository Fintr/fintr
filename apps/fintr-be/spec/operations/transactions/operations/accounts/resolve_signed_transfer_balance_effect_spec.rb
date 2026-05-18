# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Accounts::ResolveSignedTransferBalanceEffect do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) do
    create(
      :account,
      space:,
      name: "USD pot",
      balance: Money.from_amount(500, "USD"),
      balance_currency: "USD"
    )
  end
  let(:to_account) do
    create(
      :account,
      space:,
      name: "PHP pot",
      balance: Money.from_amount(10_000, "PHP"),
      balance_currency: "PHP"
    )
  end

  describe "#call" do
    context "when transfer has a persisted currency_conversion" do
      let(:transfer) do
        t = Transactions::Transfer.new(
          user:,
          space:,
          from_account:,
          to_account:,
          amount: Money.from_amount(5600, "PHP"),
          transaction_cost: Money.from_amount(0, "PHP"),
          date: Time.zone.today,
          balance_state: "calculated",
          schedule_type: "one_time",
          schedule: {},
          description: "Cross-currency transfer"
        )
        t.build_currency_conversion(
          space_id: space.id,
          original_amount_cents: 100_00,
          original_currency: "USD",
          converted_amount_cents: 5600_00,
          converted_currency: "PHP",
          exchange_rate: 56.0,
          source: "manual",
          rate_timestamp: Time.current
        )
        t.save!
        t
      end

      it "uses booked original money for the from account without calling FetchRate" do
        expect(ExchangeRates::Operations::FetchRate).not_to receive(:new)

        result = operation.call(transfer:, account: from_account)

        expect(result).to be_success
        expect(result.value![:amount]).to eq(BigDecimal("-100"))
      end

      it "uses booked converted money for the to account without calling FetchRate" do
        expect(ExchangeRates::Operations::FetchRate).not_to receive(:new)

        result = operation.call(transfer:, account: to_account)

        expect(result).to be_success
        expect(result.value![:amount]).to eq(BigDecimal("5600"))
      end
    end

    context "when both accounts are USD but amount_currency was mislabeled (legacy, no conversion)" do
      let(:from_account) do
        create(
          :account,
          space:,
          name: "From USD",
          balance: Money.from_amount(900, "USD"),
          balance_currency: "USD"
        )
      end
      let(:to_account) do
        create(
          :account,
          space:,
          name: "To USD",
          balance: Money.from_amount(600, "USD"),
          balance_currency: "USD"
        )
      end
      let(:transfer) do
        t = Transactions::Transfer.new(
          user:,
          space:,
          from_account:,
          to_account:,
          amount_cents: 100_00,
          amount_currency: "PHP",
          transaction_cost_cents: 0,
          transaction_cost_currency: "PHP",
          date: Time.zone.today,
          balance_state: "calculated",
          schedule_type: "one_time",
          schedule: {},
          description: "Legacy mis-tag"
        )
        t.save!(validate: false)
        t
      end

      it "returns signed effects using the numeric as USD without FetchRate" do
        expect(ExchangeRates::Operations::FetchRate).not_to receive(:new)

        from_result = operation.call(transfer:, account: from_account)
        to_result = operation.call(transfer:, account: to_account)

        expect(from_result.value![:amount]).to eq(BigDecimal("-100"))
        expect(to_result.value![:amount]).to eq(BigDecimal("100"))
      end
    end

    context "when there is no currency_conversion and currencies match" do
      let(:from_account) { create(:account, space:, balance: Money.from_amount(1000, "PHP")) }
      let(:to_account) { create(:account, space:, name: "Checking", balance: Money.from_amount(500, "PHP")) }
      let(:transfer) do
        create(
          :transfer,
          user:,
          space:,
          from_account:,
          to_account:,
          amount: Money.from_amount(100, "PHP"),
          transaction_cost: Money.from_amount(0, "PHP"),
          date: Time.zone.today,
          balance_state: "calculated"
        )
      end

      it "returns a negative debit for the from account" do
        result = operation.call(transfer:, account: from_account)

        expect(result).to be_success
        expect(result.value![:amount]).to eq(BigDecimal("-100"))
      end

      it "returns a positive credit for the to account" do
        result = operation.call(transfer:, account: to_account)

        expect(result).to be_success
        expect(result.value![:amount]).to eq(BigDecimal("100"))
      end
    end

    context "when the account is neither from nor to" do
      let(:from_account) { create(:account, space:, balance: Money.from_amount(1000, "PHP")) }
      let(:to_account) { create(:account, space:, name: "Checking", balance: Money.from_amount(500, "PHP")) }
      let(:other_account) { create(:account, space:, name: "Other") }
      let(:transfer) do
        create(
          :transfer,
          user:,
          space:,
          from_account:,
          to_account:,
          amount: Money.from_amount(100, "PHP"),
          transaction_cost: Money.from_amount(0, "PHP"),
          date: Time.zone.today,
          balance_state: "calculated"
        )
      end

      it "returns a failure" do
        result = operation.call(transfer:, account: other_account)

        expect(result).to be_failure
        expect(result.failure[:account]).to eq("does not belong to this transfer")
      end
    end
  end
end
