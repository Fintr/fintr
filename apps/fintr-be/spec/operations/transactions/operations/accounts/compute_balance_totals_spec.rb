# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Accounts::ComputeBalanceTotals do
  let(:operation) { described_class.new }
  let(:space) { create(:space, currency: "PHP") }

  describe "#call" do
    subject(:result) { operation.call(accounts:, space:) }

    context "with mixed account categories" do
      let!(:cash_account) do
        create(
          :account,
          space: space,
          account_category: "cash",
          balance_cents: 100_000,
          balance_currency: "PHP"
        )
      end
      let!(:savings_account) do
        create(
          :account,
          space: space,
          account_category: "savings",
          balance_cents: 250_000,
          balance_currency: "PHP"
        )
      end
      let!(:credit_card_account) do
        create(
          :account,
          space: space,
          account_category: "credit_card",
          balance_cents: -50_000,
          balance_currency: "PHP"
        )
      end
      let!(:loan_account) do
        create(
          :account,
          space: space,
          account_category: "loan",
          balance_cents: -20_000,
          balance_currency: "PHP"
        )
      end
      let(:accounts) do
        [
          cash_account,
          savings_account,
          credit_card_account,
          loan_account
        ]
      end

      it { is_expected.to be_success }

      it "returns the combined total in space currency" do
        expect(result.value![:total]).to eq(2800.0)
      end

      it "returns the cash-only total for liquid cash categories" do
        expect(result.value![:cash_total]).to eq(3500.0)
      end

      it "returns the payable total for credit card accounts" do
        expect(result.value![:payable_total]).to eq(-500.0)
      end

      it "returns the space currency code" do
        expect(result.value![:currency]).to eq("PHP")
      end
    end

    context "with an investment account" do
      let!(:cash_account) do
        create(
          :account,
          space: space,
          account_category: "cash",
          balance_cents: 100_000,
          balance_currency: "PHP"
        )
      end
      let!(:investment_account) do
        create(
          :account,
          space: space,
          account_category: "investment",
          balance_cents: 500_000,
          balance_currency: "PHP"
        )
      end
      let(:accounts) { [cash_account, investment_account] }

      it "excludes investment balances from the cash-only total" do
        expect(result.value![:cash_total]).to eq(1000.0)
      end

      it "still includes investment balances in the combined total" do
        expect(result.value![:total]).to eq(6000.0)
      end
    end

    context "when space is invalid" do
      let(:accounts) { [] }
      let(:space) { "not-a-space" }

      it { is_expected.to be_failure }
    end
  end
end
