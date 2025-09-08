# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::DeleteThisTransfer do
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
           balance_state: "calculated")
  end

  describe '#validate' do
    context 'with valid parameters' do
      it 'succeeds when transfer is provided' do
        result = operation.validate(params: { transfer: transfer })
        expect(result).to be_success
        expect(result.value![:transfer]).to eq(transfer)
      end
    end

    context 'with invalid parameters' do
      it 'fails when transfer is not a Transfer object' do
        result = operation.validate(params: { transfer: "not a transfer" })
        expect(result).to be_failure
        expect(result.failure[:transfer]).to include("must be a transfer")
      end

      it 'fails when transfer is nil' do
        result = operation.validate(params: { transfer: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end
    end
  end

  describe '#call' do
    context 'with valid transfer' do
      context 'when transfer has calculated balance state' do
        it 'deletes transfer and reverts account balances' do
          transfer # Ensure transfer is created
          expect {
            result = operation.call(transfer: transfer)
            expect(result).to be_success
            expect(result.value!).to eq(transfer)
          }.to change(Transactions::Transfer, :count).by(-1)

          from_account.reload
          to_account.reload

          # Balances should be reverted
          expect(from_account.balance).to eq(Money.from_amount(1100, "PHP")) # 1000 + 100
          expect(to_account.balance).to eq(Money.from_amount(400, "PHP")) # 500 - 100
        end

        it 'calls revert_calculated_balances when balance_state is calculated' do
          allow(operation).to receive(:revert_calculated_balances).with(transfer: transfer).and_return(Success([from_account, to_account]))
          allow(operation).to receive(:delete_transfer_fee_transaction).with(transfer: transfer).and_return(Success())
          allow(operation).to receive(:delete_transfer).with(transfer: transfer).and_return(Success(transfer))

          result = operation.call(transfer: transfer)
          expect(result).to be_success
        end
      end

      context 'when transfer has pending balance state' do
        let(:pending_transfer) do
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

        it 'deletes transfer without reverting balances' do
          pending_transfer # Ensure transfer is created
          expect {
            result = operation.call(transfer: pending_transfer)
            expect(result).to be_success
            expect(result.value!).to eq(pending_transfer)
          }.to change(Transactions::Transfer, :count).by(-1)

          from_account.reload
          to_account.reload

          # Balances should remain unchanged
          expect(from_account.balance).to eq(Money.from_amount(1000, "PHP"))
          expect(to_account.balance).to eq(Money.from_amount(500, "PHP"))
        end

        it 'does not call revert_calculated_balances when balance_state is pending' do
          allow(operation).to receive(:revert_calculated_balances)
          allow(operation).to receive(:delete_transfer_fee_transaction).with(transfer: pending_transfer).and_return(Success())
          allow(operation).to receive(:delete_transfer).with(transfer: pending_transfer).and_return(Success(pending_transfer))

          result = operation.call(transfer: pending_transfer)
          expect(result).to be_success
          expect(operation).not_to have_received(:revert_calculated_balances)
        end
      end

      context 'when transfer has associated fee transaction' do
        let!(:fee_transaction) do
          create(:transaction,
                 user:,
                 space:,
                 account: from_account,
                 amount: Money.from_amount(10, "PHP"),
                 transfer_id: transfer.id,
                 description: "Transfer fee")
        end

        it 'deletes the fee transaction' do
          delete_this_transaction_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
          allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_this_transaction_operation)
          allow(delete_this_transaction_operation).to receive(:call).and_return(Success())

          result = operation.call(transfer: transfer)
          expect(result).to be_success

          expect(delete_this_transaction_operation).to have_received(:call).with(transaction: kind_of(Transactions::Transaction))
        end
      end

      context 'when transfer has no associated fee transaction' do
        it 'succeeds without trying to delete fee transaction' do
          delete_this_transaction_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
          allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_this_transaction_operation)
          allow(delete_this_transaction_operation).to receive(:call).and_return(Success())

          result = operation.call(transfer: transfer)
          expect(result).to be_success

          expect(delete_this_transaction_operation).not_to have_received(:call)
        end
      end
    end

    context 'with invalid transfer' do
      it 'fails validation when transfer is not provided' do
        result = operation.call(transfer: nil)
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end

      it 'fails validation when transfer is not a Transfer object' do
        result = operation.call(transfer: "invalid")
        expect(result).to be_failure
        expect(result.failure[:transfer]).to include("must be a transfer")
      end
    end
  end

  describe '#revert_calculated_balances' do
    it 'reverts account balances correctly' do
      result = operation.send(:revert_calculated_balances, transfer: transfer)
      expect(result).to be_success

      from_account.reload
      to_account.reload

      expect(from_account.balance).to eq(Money.from_amount(1100, "PHP")) # 1000 + 100
      expect(to_account.balance).to eq(Money.from_amount(400, "PHP")) # 500 - 100
    end

    it 'returns both accounts in success result' do
      result = operation.send(:revert_calculated_balances, transfer: transfer)
      expect(result).to be_success
      expect(result.value!).to eq([from_account, to_account])
    end

    context 'when account save fails' do
      it 'returns failure with error details' do
        allow(from_account).to receive(:save!).and_raise(StandardError.new("Save failed"))

        result = operation.send(:revert_calculated_balances, transfer: transfer)
        expect(result).to be_failure
        expect(result.failure[:accounts]).to eq("failed to revert balances")
        expect(result.failure[:error]).to be_a(StandardError)
      end
    end
  end

  describe '#delete_transfer_fee_transaction' do
    context 'when fee transaction exists' do
      let!(:fee_transaction) do
        create(:transaction,
               user:,
               space:,
               account: from_account,
               amount: Money.from_amount(10, "PHP"),
               transfer_id: transfer.id,
               description: "Transfer fee")
      end

      it 'calls DeleteThisTransaction operation' do
        delete_this_transaction_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_this_transaction_operation)
        allow(delete_this_transaction_operation).to receive(:call).and_return(Success())

        result = operation.send(:delete_transfer_fee_transaction, transfer: transfer)
        expect(result).to be_success

        expect(delete_this_transaction_operation).to have_received(:call).with(transaction: kind_of(Transactions::Transaction))
      end

      context 'when DeleteThisTransaction operation fails' do
        it 'returns failure with error details' do
          delete_this_transaction_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
          allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_this_transaction_operation)
          allow(delete_this_transaction_operation).to receive(:call).and_raise(StandardError.new("Delete failed"))

          result = operation.send(:delete_transfer_fee_transaction, transfer: transfer)
          expect(result).to be_failure
          expect(result.failure[:fee_transaction]).to eq("failed to delete transfer fee transaction")
          expect(result.failure[:error]).to be_a(StandardError)
        end
      end
    end

    context 'when no fee transaction exists' do
      it 'returns success without calling DeleteThisTransaction' do
        delete_this_transaction_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_this_transaction_operation)
        allow(delete_this_transaction_operation).to receive(:call).and_return(Success())

        result = operation.send(:delete_transfer_fee_transaction, transfer: transfer)
        expect(result).to be_success

        expect(delete_this_transaction_operation).not_to have_received(:call)
      end
    end
  end

  describe '#delete_transfer' do
    it 'deletes the transfer successfully' do
      transfer # Ensure transfer is created
      expect {
        result = operation.send(:delete_transfer, transfer: transfer)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      }.to change(Transactions::Transfer, :count).by(-1)
    end

    context 'when transfer deletion fails' do
      it 'returns failure with error details' do
        allow(transfer).to receive(:destroy!).and_raise(StandardError.new("Delete failed"))

        result = operation.send(:delete_transfer, transfer: transfer)
        expect(result).to be_failure
        expect(result.failure[:transfer]).to eq("failed to delete transfer")
        expect(result.failure[:error]).to be_a(StandardError)
      end
    end
  end
end
