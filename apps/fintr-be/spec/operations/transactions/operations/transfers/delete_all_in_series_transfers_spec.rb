# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::DeleteAllInSeriesTransfers do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:parent_transfer) do
    create(:transfer,
           :repeat,
           user:,
           space:,
           from_account:,
           to_account:,
           amount: Money.from_amount(100, "PHP"),
           date: Time.zone.today)
  end
  let(:child_transfer_1) do
    create(:transfer,
           user:,
           space:,
           from_account:,
           to_account:,
           amount: Money.from_amount(100, "PHP"),
           date: Time.zone.today + 1.month,
           parent_id: parent_transfer.id)
  end
  let(:child_transfer_2) do
    create(:transfer,
           user:,
           space:,
           from_account:,
           to_account:,
           amount: Money.from_amount(100, "PHP"),
           date: Time.zone.today + 2.months,
           parent_id: parent_transfer.id)
  end

  before do
    # Ensure all transfers are created and associated
    parent_transfer
    child_transfer_1
    child_transfer_2
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when transfer is missing' do
        result = operation.validate(params: { transfer: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end
    end

    context 'with invalid transfer parameter' do
      it 'fails when transfer is not a Transfer object' do
        result = operation.validate(params: { transfer: "invalid" })
        expect(result).to be_failure
        expect(result.failure[:transfer]).to include("must be a transfer")
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation with transfer only' do
        result = operation.validate(params: { transfer: parent_transfer })
        expect(result).to be_success
      end

      it 'succeeds validation with transfer and except_this_transfer' do
        result = operation.validate(params: {
          transfer: parent_transfer,
          except_this_transfer: true
        })
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    let(:delete_this_transfer_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisTransfer) }

    before do
      allow(Transactions::Operations::Transfers::DeleteThisTransfer).to receive(:new).and_return(delete_this_transfer_operation)
      allow(delete_this_transfer_operation).to receive(:call).and_return(Success())
    end

    context 'when validation fails' do
      it 'returns validation failure' do
        result = operation.call({ transfer: "invalid" })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end
    end

    context 'with valid transfer' do
      it 'deletes all transfers in the series except the current one' do
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: parent_transfer).and_return(Success())

        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success
      end

      it 'returns the series transfers' do
        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success
        expect(result.value!).to eq(parent_transfer.series_transfers)
      end
    end

    context 'with except_this_transfer parameter' do
      it 'deletes all transfers in the series except the current one when except_this_transfer is true' do
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())
        expect(delete_this_transfer_operation).not_to receive(:call).with(transfer: parent_transfer)

        result = operation.call({
          transfer: parent_transfer,
          except_this_transfer: true
        })
        expect(result).to be_success
      end

      it 'deletes all transfers in the series including the current one when except_this_transfer is false' do
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: parent_transfer).and_return(Success())

        result = operation.call({
          transfer: parent_transfer,
          except_this_transfer: false
        })
        expect(result).to be_success
      end
    end

    context 'when DeleteThisTransfer operation fails' do
      it 'continues execution and returns success even if individual deletions fail' do
        allow(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Failure(error: "deletion failed"))
        allow(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())
        allow(delete_this_transfer_operation).to receive(:call).with(transfer: parent_transfer).and_return(Success())

        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success
        expect(result.value!).to eq(parent_transfer.series_transfers)
      end
    end
  end

  describe '#find_transfer' do
    it 'returns the transfer from params' do
      result = operation.send(:find_transfer, params: { transfer: parent_transfer })
      expect(result).to be_success
      expect(result.value!).to eq(parent_transfer)
    end
  end

  describe '#find_transfers' do
    it 'returns the series transfers for the given transfer' do
      result = operation.send(:find_transfers, params: { transfer: parent_transfer })
      expect(result).to be_success
      expect(result.value!).to eq(parent_transfer.series_transfers)
    end

    it 'includes all transfers in the series' do
      result = operation.send(:find_transfers, params: { transfer: parent_transfer })
      series_transfers = result.value!

      expect(series_transfers).to include(parent_transfer)
      expect(series_transfers).to include(child_transfer_1)
      expect(series_transfers).to include(child_transfer_2)
    end
  end

  describe '#delete_transfers' do
    let(:delete_this_transfer_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisTransfer) }
    let(:transfers) { parent_transfer.series_transfers }

    before do
      allow(Transactions::Operations::Transfers::DeleteThisTransfer).to receive(:new).and_return(delete_this_transfer_operation)
      allow(delete_this_transfer_operation).to receive(:call).and_return(Success())
    end

    context 'when except_this_transfer is not specified' do
      it 'deletes all transfers in the series including the current one' do
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: parent_transfer).and_return(Success())

        result = operation.send(:delete_transfers,
                                transfer: parent_transfer,
                                transfers:,
                                params: { transfer: parent_transfer })
        expect(result).to be_success
      end
    end

    context 'when except_this_transfer is true' do
      it 'deletes all transfers in the series except the current one' do
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())
        expect(delete_this_transfer_operation).not_to receive(:call).with(transfer: parent_transfer)

        result = operation.send(:delete_transfers,
                                transfer: parent_transfer,
                                transfers:,
                                params: {
                                  transfer: parent_transfer,
                                  except_this_transfer: true
                                })
        expect(result).to be_success
      end
    end

    context 'when except_this_transfer is false' do
      it 'deletes all transfers in the series including the current one' do
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: parent_transfer).and_return(Success())

        result = operation.send(:delete_transfers,
                                transfer: parent_transfer,
                                transfers:,
                                params: {
                                  transfer: parent_transfer,
                                  except_this_transfer: false
                                })
        expect(result).to be_success
      end
    end

    it 'returns the transfers collection' do
      result = operation.send(:delete_transfers,
                              transfer: parent_transfer,
                              transfers:,
                              params: { transfer: parent_transfer })
      expect(result).to be_success
      expect(result.value!).to eq(transfers)
    end
  end
end
