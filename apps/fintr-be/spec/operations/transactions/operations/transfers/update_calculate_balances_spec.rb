# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::UpdateCalculateBalances do
  include Dry::Monads[:result]

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
           schedule_type: "one_time")
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when transfer is missing' do
        result = operation.validate(params: { transfer: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end
    end

    context 'with invalid transfer' do
      it 'fails when transfer has no changes' do
        result = operation.validate(params: { transfer: transfer })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end
    end

    context 'with valid transfer with changes' do
      let(:transfer_with_changes) do
        transfer.amount = Money.from_amount(200, "PHP")
        transfer
      end

      it 'succeeds validation' do
        result = operation.validate(params: { transfer: transfer_with_changes })
        expect(result).to be_success
        expect(result.value!).to eq({ transfer: transfer_with_changes })
      end
    end
  end

  describe '#call' do
    let(:transfer_with_changes) do
      transfer.amount = Money.from_amount(200, "PHP")
      transfer
    end
    let(:valid_params) { { transfer: transfer_with_changes } }

    context 'with valid transfer with changes' do
      it 'updates balances for both previous and current accounts' do
        result = operation.call(valid_params)
        expect(result).to be_success

        expect(result.value!.value!).to be_a(Transactions::Transfer)
      end

      it 'reverts previous transfer effects and applies new ones' do
        # Store original balances
        original_from_balance = from_account.balance_cents
        original_to_balance = to_account.balance_cents

        result = operation.call(valid_params)
        expect(result).to be_success

        # Reload accounts to get updated balances
        from_account.reload
        to_account.reload

        # The balance should reflect the new amount (200) instead of the old amount (100)
        # First it reverts the old amount (100), then applies the new amount (200)
        # So the net effect is: original - 100 + 100 - 200 = original - 200
        # But the original balance already had the old transfer applied, so we need to account for that
        expected_from_balance = original_from_balance + 10000 - 20000 # +100 (revert) -200 (apply new)
        expected_to_balance = original_to_balance - 10000 + 20000 # -100 (revert) +200 (apply new)

        expect(from_account.balance_cents).to eq(expected_from_balance)
        expect(to_account.balance_cents).to eq(expected_to_balance)
      end
    end

    context 'when previous account is not found' do
      before do
        allow(transfer_with_changes).to receive(:from_account_id_was).and_return("non-existent-id")
      end

      it 'returns failure with account not found error' do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:account)
        expect(result.failure[:account]).to eq("previous account not found")
      end
    end

    context 'when current account is not found' do
      before do
        allow(transfer_with_changes).to receive(:from_account).and_return(nil)
        allow(transfer_with_changes).to receive(:to_account).and_return(nil)
      end

      it 'returns failure with account not found error' do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:accounts)
        expect(result.failure[:accounts]).to eq("failed to save")
      end
    end

    context 'when account save fails' do
      let(:failing_from_account) { create(:account, name: "Failing From", space:, balance: Money.from_amount(1000, "PHP")) }
      let(:failing_to_account) { create(:account, name: "Failing To", space:, balance: Money.from_amount(500, "PHP")) }
      let(:failing_transfer) do
        create(:transfer,
               user:,
               space:,
               from_account: failing_from_account,
               to_account: failing_to_account,
               amount: Money.from_amount(100, "PHP"),
               transaction_cost: Money.from_amount(10, "PHP"),
               date: Time.zone.today,
               schedule_type: "one_time")
      end
      let(:failing_transfer_with_changes) do
        failing_transfer.amount = Money.from_amount(200, "PHP")
        failing_transfer
      end

      before do
        allow(failing_from_account).to receive(:save!).and_raise(StandardError.new("Save failed"))
      end

      it 'handles save failure gracefully' do
        result = operation.call({ transfer: failing_transfer_with_changes })
        expect(result).to be_failure
        expect(result.failure).to include(:accounts)
        expect(result.failure[:accounts]).to eq("failed to save")
      end
    end

    context 'with invalid parameters' do
      it 'fails validation and does not attempt to update balances' do
        expect(Transactions::Account).not_to receive(:find)

        result = operation.call({ transfer: transfer })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end
    end
  end

  describe '#dig_transfer' do
    let(:transfer_with_changes) do
      transfer.amount = Money.from_amount(200, "PHP")
      transfer
    end

    it 'returns the transfer from params' do
      result = operation.send(:dig_transfer, params: { transfer: transfer_with_changes })
      expect(result).to be_success
      expect(result.value!).to eq(transfer_with_changes)
    end
  end

  describe '#find_previous_accounts' do
    let(:transfer_with_changes) do
      transfer.amount = Money.from_amount(200, "PHP")
      transfer
    end

    context 'when previous accounts exist' do
      it 'finds and returns previous accounts' do
        result = operation.send(:find_previous_accounts, transfer: transfer_with_changes)
        expect(result).to be_success

        accounts = result.value!
        expect(accounts).to include(:from_account, :to_account)
        expect(accounts[:from_account]).to be_a(Transactions::Account)
        expect(accounts[:to_account]).to be_a(Transactions::Account)
      end

      it 'uses from_account_id_was and to_account_id_was' do
        allow(Transactions::Account).to receive(:find).with(transfer_with_changes.from_account_id_was).and_return(from_account)
        allow(Transactions::Account).to receive(:find).with(transfer_with_changes.to_account_id_was).and_return(to_account)

        result = operation.send(:find_previous_accounts, transfer: transfer_with_changes)
        expect(result).to be_success
      end
    end

    context 'when previous account is not found' do
      before do
        allow(transfer_with_changes).to receive(:from_account_id_was).and_return("non-existent-id")
      end

      it 'returns failure with appropriate error message' do
        result = operation.send(:find_previous_accounts, transfer: transfer_with_changes)
        expect(result).to be_failure
        expect(result.failure).to include(:account)
        expect(result.failure[:account]).to eq("previous account not found")
        expect(result.failure).to include(:error)
      end
    end
  end

  describe '#find_current_accounts' do
    let(:transfer_with_changes) do
      transfer.amount = Money.from_amount(200, "PHP")
      transfer
    end

    context 'when current accounts exist' do
      it 'finds and returns current accounts' do
        result = operation.send(:find_current_accounts, transfer: transfer_with_changes)
        expect(result).to be_success

        accounts = result.value!
        expect(accounts).to include(:from_account, :to_account)
        expect(accounts[:from_account]).to be_a(Transactions::Account)
        expect(accounts[:to_account]).to be_a(Transactions::Account)
      end

      it 'uses from_account and to_account associations' do
        allow(transfer_with_changes).to receive(:from_account).and_return(from_account)
        allow(transfer_with_changes).to receive(:to_account).and_return(to_account)

        result = operation.send(:find_current_accounts, transfer: transfer_with_changes)
        expect(result).to be_success
      end
    end

    context 'when current account is not found' do
      before do
        allow(transfer_with_changes).to receive(:from_account).and_return(nil)
        allow(transfer_with_changes).to receive(:to_account).and_return(nil)
      end

      it 'returns success with nil accounts' do
        result = operation.send(:find_current_accounts, transfer: transfer_with_changes)
        expect(result).to be_success

        accounts = result.value!
        expect(accounts[:from_account]).to be_nil
        expect(accounts[:to_account]).to be_nil
      end
    end
  end

  describe '#update_balances' do
    let(:transfer_with_changes) do
      transfer.amount = Money.from_amount(200, "PHP")
      transfer
    end
    let(:previous_from_account) { create(:account, name: "Previous From", space:, balance: Money.from_amount(800, "PHP")) }
    let(:previous_to_account) { create(:account, name: "Previous To", space:, balance: Money.from_amount(600, "PHP")) }

    context 'when updating previous balances' do
      it 'reverts previous transfer effects' do
        result = operation.send(:update_balances,
                                from: :previous,
                                transfer: transfer_with_changes,
                                from_account: previous_from_account,
                                to_account: previous_to_account)

        expect(result).to be_success

        previous_from_account.reload
        previous_to_account.reload

        # Should add back the previous amount (100) to from_account
        # Should subtract the previous amount (100) from to_account
        expect(previous_from_account.balance_cents).to eq(90000) # 800 + 100
        expect(previous_to_account.balance_cents).to eq(50000) # 600 - 100
      end

      it 'saves both accounts' do
        expect(previous_from_account).to receive(:save!)
        expect(previous_to_account).to receive(:save!)

        result = operation.send(:update_balances,
                                from: :previous,
                                transfer: transfer_with_changes,
                                from_account: previous_from_account,
                                to_account: previous_to_account)

        expect(result).to be_success
      end
    end

    context 'when updating current balances' do
      it 'applies new transfer effects' do
        result = operation.send(:update_balances,
                                from: :current,
                                transfer: transfer_with_changes,
                                from_account: from_account,
                                to_account: to_account)

        expect(result).to be_success

        from_account.reload
        to_account.reload

        # Should subtract the new amount (200) from from_account
        # Should add the new amount (200) to to_account
        expect(from_account.balance_cents).to eq(80000) # 1000 - 200
        expect(to_account.balance_cents).to eq(70000) # 500 + 200
      end

      it 'saves both accounts' do
        expect(from_account).to receive(:save!)
        expect(to_account).to receive(:save!)

        result = operation.send(:update_balances,
                                from: :current,
                                transfer: transfer_with_changes,
                                from_account: from_account,
                                to_account: to_account)

        expect(result).to be_success
      end
    end

    context 'when from parameter is invalid' do
      it 'returns failure with not supported action' do
        result = operation.send(:update_balances,
                                from: :invalid,
                                transfer: transfer_with_changes,
                                from_account: from_account,
                                to_account: to_account)

        expect(result).to be_failure
        expect(result.failure).to include(:action)
        expect(result.failure[:action]).to eq("not supported")
      end
    end

    context 'when account save fails' do
      before do
        allow(from_account).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(from_account))
      end

      it 'handles save failure gracefully' do
        result = operation.send(:update_balances,
                                from: :current,
                                transfer: transfer_with_changes,
                                from_account: from_account,
                                to_account: to_account)

        expect(result).to be_failure
        expect(result.failure).to include(:accounts)
        expect(result.failure[:accounts]).to eq("failed to save")
        expect(result.failure).to include(:error)
      end
    end
  end

  describe '#transfer_amount' do
    let(:transfer_with_changes) do
      transfer.amount = Money.from_amount(200, "PHP")
      transfer
    end

    context 'when getting previous amount' do
      it 'returns the previous amount in cents' do
        allow(transfer_with_changes).to receive(:amount_cents_was).and_return(10000) # 100 PHP

        result = operation.send(:transfer_amount, transfer: transfer_with_changes, from: :previous)
        expect(result).to be_success
        expect(result.value!).to eq(10000)
      end

      it 'returns 0 when amount_cents_was is nil' do
        allow(transfer_with_changes).to receive(:amount_cents_was).and_return(nil)

        result = operation.send(:transfer_amount, transfer: transfer_with_changes, from: :previous)
        expect(result).to be_success
        expect(result.value!).to eq(0)
      end
    end

    context 'when getting current amount' do
      it 'returns the current amount in cents' do
        result = operation.send(:transfer_amount, transfer: transfer_with_changes, from: :current)
        expect(result).to be_success
        expect(result.value!).to eq(20000) # 200 PHP in cents
      end
    end
  end

  describe 'Integration Tests' do
    let(:transfer_with_changes) do
      transfer.amount = Money.from_amount(200, "PHP")
      transfer
    end

    context 'with account balance changes' do
      it 'correctly updates balances for both previous and current accounts' do
        # Store original balances
        original_from_balance = from_account.balance_cents
        original_to_balance = to_account.balance_cents

        result = operation.call({ transfer: transfer_with_changes })
        expect(result).to be_success

        # Reload accounts to get updated balances
        from_account.reload
        to_account.reload

        # The balance should reflect the new amount (200) instead of the old amount (100)
        # First it reverts the old amount (100), then applies the new amount (200)
        # So the net effect is: original - 100 + 100 - 200 = original - 200
        # But the original balance already had the old transfer applied, so we need to account for that
        expected_from_balance = original_from_balance + 10000 - 20000 # +100 (revert) -200 (apply new)
        expected_to_balance = original_to_balance - 10000 + 20000 # -100 (revert) +200 (apply new)

        expect(from_account.balance_cents).to eq(expected_from_balance)
        expect(to_account.balance_cents).to eq(expected_to_balance)
      end
    end

    context 'with multiple balance updates' do
      it 'handles multiple balance updates correctly' do
        # First update
        transfer_with_changes.amount = Money.from_amount(200, "PHP")
        result1 = operation.call({ transfer: transfer_with_changes })
        expect(result1).to be_success

        # Second update
        transfer_with_changes.amount = Money.from_amount(300, "PHP")
        result2 = operation.call({ transfer: transfer_with_changes })
        expect(result2).to be_success

        # Reload accounts to get final balances
        from_account.reload
        to_account.reload

        # The balance should reflect the final amount (300)
        expect(from_account.balance_cents).to eq(70000) # 1000 - 300
        expect(to_account.balance_cents).to eq(80000) # 500 + 300
      end
    end
  end
end
