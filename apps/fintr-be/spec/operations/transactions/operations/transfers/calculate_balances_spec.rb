# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::CalculateBalances do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:transfer) do
    create(:transfer,
           user:,
           space:,
           from_account:,
           to_account:,
           amount: Money.from_amount(100, "PHP"),
           transaction_cost: Money.from_amount(10, "PHP"),
           date: Time.zone.today,
           balance_state: "pending")
  end

  describe '#call' do
    context 'with valid transfer' do
      it 'calculates balances successfully' do
        # NOTE: transaction_cost from transfers are calculated in create_transfer_fee_transaction.
        result = operation.call(transfer_id: transfer.id)
        expect(result).to be_success

        from_account.reload
        to_account.reload
        transfer.reload

        expect(from_account.balance).to eq(Money.from_amount(900.00, "PHP")) # 1000 - 100, no transaction cost
        expect(to_account.balance).to eq(Money.from_amount(600.00, "PHP")) # 500 + 100
        expect(transfer.balance_state).to eq("calculated")
      end

      context "when both accounts are USD but amount_currency was mislabeled PHP (legacy)" do
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
            date: Time.zone.today,
            balance_state: "pending",
            schedule_type: "one_time",
            schedule: {},
            description: "Legacy"
          )
          t.save!(validate: false)
          t
        end

        it "applies debit and credit using the numeric as USD" do
          result = operation.call(transfer_id: transfer.id)
          expect(result).to be_success

          from_usd.reload
          to_usd.reload
          transfer.reload

          expect(from_usd.balance).to eq(Money.from_amount(900, "USD"))
          expect(to_usd.balance).to eq(Money.from_amount(600, "USD"))
          expect(transfer.balance_state).to eq("calculated")
        end
      end

      it 'is idempotent' do
        # First call
        result1 = operation.call(transfer_id: transfer.id)
        expect(result1).to be_success

        # Second call
        result2 = operation.call(transfer_id: transfer.id)
        expect(result2).to be_success

        # Balances should remain the same
        from_account.reload
        to_account.reload
        expect(from_account.balance).to eq(Money.from_amount(900.00, "PHP"))
        expect(to_account.balance).to eq(Money.from_amount(600.00, "PHP"))
      end
    end

    context 'with invalid transfer' do
      context 'when transfer does not exist' do
        it 'returns not found error' do
          result = operation.call(params: { transfer_id: "non-existent-id" })
          expect(result).to be_failure
          expect(result.failure).to include(:transfer_id)
        end
      end
    end
  end
end
