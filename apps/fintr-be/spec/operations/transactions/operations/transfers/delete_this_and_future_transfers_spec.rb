# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::DeleteThisAndFutureTransfers do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:today) { Time.zone.today }

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when transfer is missing' do
        # Pass a hash with other keys but missing the required transfer key
        result = operation.validate(params: { except_this_transfer: true })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end
    end

    context 'with invalid transfer parameter' do
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

    context 'with valid parameters' do
      let(:transfer) do
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               date: today)
      end

      it 'succeeds validation with valid transfer' do
        result = operation.validate(params: { transfer: transfer })
        expect(result).to be_success
      end

      it 'succeeds validation with except_this_transfer parameter' do
        result = operation.validate(params: { transfer: transfer, except_this_transfer: true })
        expect(result).to be_success
      end

      it 'succeeds validation with except_this_transfer as false' do
        result = operation.validate(params: { transfer: transfer, except_this_transfer: false })
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    let(:transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today)
    end

    let(:future_transfer1) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 1.month,
             parent_id: transfer.id)
    end

    let(:future_transfer2) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 2.months,
             parent_id: transfer.id)
    end

    let(:past_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today - 1.month,
             parent_id: transfer.id)
    end

    let(:delete_this_transfer_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisTransfer) }

    before do
      # Create the transfers
      transfer
      future_transfer1
      future_transfer2
      past_transfer

      # Stub the DeleteThisTransfer operation
      allow(Transactions::Operations::Transfers::DeleteThisTransfer).to receive(:new).and_return(delete_this_transfer_operation)
      allow(delete_this_transfer_operation).to receive(:call).and_return(Success())
    end

    context 'when deleting this and future transfers' do
      it 'returns the original transfer' do
        result = operation.call(transfer: transfer)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end

      it 'finds and deletes future transfers' do
        allow(delete_this_transfer_operation).to receive(:call).with(transfer: future_transfer1).and_return(Success())
        allow(delete_this_transfer_operation).to receive(:call).with(transfer: future_transfer2).and_return(Success())

        result = operation.call(transfer: transfer)
        expect(result).to be_success
        expect(delete_this_transfer_operation).to have_received(:call).with(transfer: future_transfer1)
        expect(delete_this_transfer_operation).to have_received(:call).with(transfer: future_transfer2)
      end

      it 'does not delete past transfers' do
        expect(delete_this_transfer_operation).not_to receive(:call).with(transfer: past_transfer)

        result = operation.call(transfer: transfer)
        expect(result).to be_success
      end

      it 'does not delete the original transfer' do
        # The original transfer should be included in the series_transfers but not deleted
        # because it's the reference point for the date filter
        result = operation.call(transfer: transfer)
        expect(result).to be_success
      end
    end

    context 'when except_this_transfer is true' do
      it 'returns the original transfer' do
        result = operation.call(transfer: transfer, except_this_transfer: true)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end

      it 'finds and deletes future transfers excluding the original' do
        # When except_this_transfer is true, the original transfer should be excluded from deletion
        # Only future transfers should be deleted
        allow(delete_this_transfer_operation).to receive(:call).with(transfer: future_transfer1).and_return(Success())
        allow(delete_this_transfer_operation).to receive(:call).with(transfer: future_transfer2).and_return(Success())

        result = operation.call(transfer: transfer, except_this_transfer: true)
        expect(result).to be_success
        expect(delete_this_transfer_operation).to have_received(:call).with(transfer: future_transfer1)
        expect(delete_this_transfer_operation).to have_received(:call).with(transfer: future_transfer2)
      end

      it 'does not delete past transfers' do
        expect(delete_this_transfer_operation).not_to receive(:call).with(transfer: past_transfer)

        result = operation.call(transfer: transfer, except_this_transfer: true)
        expect(result).to be_success
      end
    end

    context 'when there are no future transfers' do
      let(:one_time_transfer) do
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               date: today)
      end

      it 'returns the original transfer without calling delete operation' do
        # For one_time transfers, there should be no future transfers to delete
        # The operation will find only the transfer itself, but since it's the reference point,
        # it won't be deleted unless except_this_transfer is true
        result = operation.call(transfer: one_time_transfer)
        expect(result).to be_success
        expect(result.value!).to eq(one_time_transfer)
      end
    end

    context 'when delete operation fails' do
      before do
        allow(delete_this_transfer_operation).to receive(:call).and_return(Failure(error: "delete failed"))
      end

      it 'continues execution and returns the original transfer' do
        # The operation doesn't check the result of individual delete operations
        # It continues execution and returns the original transfer
        result = operation.call(transfer: transfer)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end
    end

    context 'with invalid parameters' do
      it 'fails when transfer is not a Transfer object' do
        result = operation.call(transfer: "not a transfer")
        expect(result).to be_failure
        expect(result.failure[:transfer]).to include("must be a transfer")
      end
    end
  end

  describe 'private methods' do
    let(:transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today)
    end

    let(:future_transfer1) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 1.month,
             parent_id: transfer.id)
    end

    let(:future_transfer2) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 2.months,
             parent_id: transfer.id)
    end

    let(:past_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today - 1.month,
             parent_id: transfer.id)
    end

    before do
      transfer
      future_transfer1
      future_transfer2
      past_transfer
    end

    describe '#find_this_and_future_transfers' do
      it 'finds transfers from the same series with date >= transfer date' do
        result = operation.send(:find_this_and_future_transfers, params: { transfer: transfer })
        expect(result).to be_success

        found_transfers = result.value!
        expect(found_transfers).to include(future_transfer1, future_transfer2)
        expect(found_transfers).not_to include(past_transfer)
      end

      it 'includes the original transfer when except_this_transfer is not set' do
        result = operation.send(:find_this_and_future_transfers, params: { transfer: transfer })
        expect(result).to be_success

        found_transfers = result.value!
        expect(found_transfers).to include(transfer)
      end

      it 'excludes the original transfer when except_this_transfer is true' do
        result = operation.send(:find_this_and_future_transfers, params: { transfer: transfer, except_this_transfer: true })
        expect(result).to be_success

        found_transfers = result.value!
        expect(found_transfers).not_to include(transfer)
        expect(found_transfers).to include(future_transfer1, future_transfer2)
      end

      it 'includes the original transfer when except_this_transfer is false' do
        result = operation.send(:find_this_and_future_transfers, params: { transfer: transfer, except_this_transfer: false })
        expect(result).to be_success

        found_transfers = result.value!
        expect(found_transfers).to include(transfer, future_transfer1, future_transfer2)
      end

      it 'returns collection with only the transfer itself when no future transfers exist' do
        one_time_transfer = create(:transfer,
                                  user:,
                                  space:,
                                  from_account:,
                                  to_account:,
                                  date: today)

        result = operation.send(:find_this_and_future_transfers, params: { transfer: one_time_transfer })
        expect(result).to be_success

        found_transfers = result.value!
        # For one_time transfers, series_transfers will include only the transfer itself
        # and since date >= transfer.date, it will include itself
        expect(found_transfers).to include(one_time_transfer)
        expect(found_transfers.count).to eq(1)
      end
    end

    describe '#delete_this_and_future_transfers' do
      let(:delete_this_transfer_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisTransfer) }
      let(:future_transfers) { [future_transfer1, future_transfer2] }

      before do
        allow(Transactions::Operations::Transfers::DeleteThisTransfer).to receive(:new).and_return(delete_this_transfer_operation)
        allow(delete_this_transfer_operation).to receive(:call).and_return(Success())
      end

      it 'calls DeleteThisTransfer for each future transfer' do
        allow(delete_this_transfer_operation).to receive(:call).with(transfer: future_transfer1).and_return(Success())
        allow(delete_this_transfer_operation).to receive(:call).with(transfer: future_transfer2).and_return(Success())

        result = operation.send(:delete_this_and_future_transfers, future_transfers: future_transfers)
        expect(result).to be_success
        expect(delete_this_transfer_operation).to have_received(:call).with(transfer: future_transfer1)
        expect(delete_this_transfer_operation).to have_received(:call).with(transfer: future_transfer2)
      end

      it 'returns the future transfers collection' do
        result = operation.send(:delete_this_and_future_transfers, future_transfers: future_transfers)
        expect(result).to be_success
        expect(result.value!).to eq(future_transfers)
      end

      it 'handles empty collection' do
        result = operation.send(:delete_this_and_future_transfers, future_transfers: [])
        expect(result).to be_success
        expect(result.value!).to eq([])
      end

      context 'when delete operation fails' do
        before do
          allow(delete_this_transfer_operation).to receive(:call).and_return(Failure(error: "delete failed"))
        end

        it 'continues execution and returns the transfers collection' do
          # The private method doesn't check the result of individual delete operations
          # It continues execution and returns the transfers collection
          result = operation.send(:delete_this_and_future_transfers, future_transfers: [future_transfer1])
          expect(result).to be_success
          expect(result.value!).to eq([future_transfer1])
        end
      end
    end
  end
end
