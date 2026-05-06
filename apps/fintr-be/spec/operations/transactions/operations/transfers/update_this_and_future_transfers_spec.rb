# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::UpdateThisAndFutureTransfers do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:today) { Time.zone.today }

  describe '#validate' do
    context 'with valid parameters' do
      let(:transfer) do
        create(:transfer, user:, space:, from_account:, to_account:).tap do |t|
          t.amount = Money.from_amount(200, "PHP")
        end
      end

      it 'succeeds validation with transfer only' do
        result = operation.validate(params: { transfer: transfer })
        expect(result).to be_success
      end

      it 'succeeds validation with transfer and all_in_series' do
        result = operation.validate(params: {
          transfer: transfer,
          all_in_series: true
        })
        expect(result).to be_success
      end

      it 'fails when transfer is not changed' do
        unchanged_transfer = create(:transfer, user:, space:, from_account:, to_account:)
        result = operation.validate(params: { transfer: unchanged_transfer })
        expect(result).to be_failure
        expect(result.failure[:transfer]).to include("must be a changed transfer")
      end
    end
  end

  describe '#call' do
    let(:parent_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             amount: Money.from_amount(100, "PHP"),
             date: today).tap do |t|
        t.amount = Money.from_amount(200, "PHP")
      end
    end

    let(:child_transfer_1) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             amount: Money.from_amount(100, "PHP"),
             date: today + 1.month,
             parent_id: parent_transfer.id)
    end

    let(:child_transfer_2) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             amount: Money.from_amount(100, "PHP"),
             date: today + 2.months,
             parent_id: parent_transfer.id)
    end

    let(:past_transfer) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             amount: Money.from_amount(100, "PHP"),
             date: today - 1.month,
             parent_id: parent_transfer.id)
    end

    let(:delete_this_transfer_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisTransfer) }
    let(:create_repeat_transfers_operation) { instance_double(Transactions::Operations::Transfers::CreateRepeatTransfers) }

    before do
      # Create the transfers
      parent_transfer
      child_transfer_1
      child_transfer_2
      past_transfer

      # Stub external operations
      allow(Transactions::Operations::Transfers::DeleteThisTransfer).to receive(:new).and_return(delete_this_transfer_operation)
      allow(delete_this_transfer_operation).to receive(:call).and_return(Success())

      allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_transfers_operation)
      allow(create_repeat_transfers_operation).to receive(:call).and_return(Success())
    end

    context 'when validation fails' do
      it 'returns validation failure for unchanged transfer' do
        unchanged_transfer = create(:transfer, user:, space:, from_account:, to_account:)
        result = operation.call({ transfer: unchanged_transfer })
        expect(result).to be_failure
        expect(result.failure[:transfer]).to include("must be a changed transfer")
      end
    end

    context 'with valid transfer' do
      it 'returns the updated transfer' do
        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success
        expect(result.value!).to eq(parent_transfer)
      end

      it 'updates effective parent for previous transfers' do
        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success

        child_transfer_1.reload
        child_transfer_2.reload
        expect(child_transfer_1.effective_parent_id).to eq(parent_transfer.id)
        expect(child_transfer_2.effective_parent_id).to eq(parent_transfer.id)
      end

      it 'clears schedules from series transfers' do
        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success

        child_transfer_1.reload
        child_transfer_2.reload
        expect(child_transfer_1.schedule).to eq({})
        expect(child_transfer_2.schedule).to eq({})
      end

      it 'deletes pending transfers' do
        child_transfer_1.update!(balance_state: "pending")
        child_transfer_2.update!(balance_state: "pending")

        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())

        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success
      end

      it 'deletes calculated transfers' do
        child_transfer_1.update!(balance_state: "calculated")
        child_transfer_2.update!(balance_state: "calculated")

        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())

        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success
      end

      it 'recreates past to present transfers for repeat transfers' do
        parent_transfer.update!(date: today - 1.day)
        parent_transfer.amount = Money.from_amount(300, "PHP") # Make sure transfer is changed

        expect(create_repeat_transfers_operation).to receive(:call).with(params: {
          transfer: parent_transfer,
          balance_state: "calculated",
          date_start: today.to_datetime,
          date_end: today
        }).and_return(Success())

        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success
      end

      it 'recreates future transfers for repeat transfers' do
        expect(create_repeat_transfers_operation).to receive(:call).with(params: {
          transfer: parent_transfer,
          balance_state: "pending",
          date_start: today + 1.day,
          date_end: today + 1.month
        }).and_return(Success())

        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success
      end

      it 'does not recreate transfers for one_time transfers' do
        one_time_transfer = create(:transfer,
                                  user:,
                                  space:,
                                  from_account:,
                                  to_account:,
                                  schedule_type: "one_time").tap do |t|
          t.amount = Money.from_amount(200, "PHP")
        end

        expect(create_repeat_transfers_operation).not_to receive(:call)

        result = operation.call({ transfer: one_time_transfer })
        expect(result).to be_success
      end
    end

    context 'with all_in_series parameter' do
      it 'includes all transfers in series when all_in_series is true' do
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: past_transfer).and_return(Success())

        result = operation.call({
          transfer: parent_transfer,
          all_in_series: true
        })
        expect(result).to be_success
      end

      it 'includes only future transfers when all_in_series is false' do
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())
        expect(delete_this_transfer_operation).not_to receive(:call).with(transfer: past_transfer)

        result = operation.call({
          transfer: parent_transfer,
          all_in_series: false
        })
        expect(result).to be_success
      end

      it 'includes only future transfers when all_in_series is not specified' do
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_1).and_return(Success())
        expect(delete_this_transfer_operation).to receive(:call).with(transfer: child_transfer_2).and_return(Success())
        expect(delete_this_transfer_operation).not_to receive(:call).with(transfer: past_transfer)

        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success
      end
    end

    context 'when external operations fail' do
      it 'continues execution when delete operations fail' do
        allow(delete_this_transfer_operation).to receive(:call).and_return(Failure(error: "delete failed"))

        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_success
        expect(result.value!).to eq(parent_transfer)
      end

      it 'propagates failure when create repeat transfers fails' do
        allow(create_repeat_transfers_operation).to receive(:call).and_return(Failure(error: "create failed"))

        result = operation.call({ transfer: parent_transfer })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end
  end

  describe '#find_transfer' do
    let(:transfer) do
      create(:transfer, user:, space:, from_account:, to_account:).tap do |t|
        t.amount = Money.from_amount(200, "PHP")
      end
    end

    it 'returns the transfer from params' do
      result = operation.send(:find_transfer, params: { transfer: transfer })
      expect(result).to be_success
      expect(result.value!).to eq(transfer)
    end
  end

  describe '#find_previous_transfers' do
    let(:parent_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today)
    end

    let(:child_transfer_1) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 1.month,
             parent_id: parent_transfer.id)
    end

    let(:child_transfer_2) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 2.months,
             parent_id: parent_transfer.id)
    end

    let(:past_transfer) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today - 1.month,
             parent_id: parent_transfer.id)
    end

    before do
      parent_transfer
      child_transfer_1
      child_transfer_2
      past_transfer
    end

    context 'when all_in_series is true' do
      it 'returns all transfers in series except the current one' do
        result = operation.send(:find_previous_transfers,
                               transfer: parent_transfer,
                               params: { transfer: parent_transfer, all_in_series: true })
        expect(result).to be_success

        previous_transfers = result.value!
        expect(previous_transfers).to include(child_transfer_1, child_transfer_2, past_transfer)
        expect(previous_transfers).not_to include(parent_transfer)
      end
    end

    context 'when all_in_series is false or not specified' do
      it 'returns only future transfers' do
        result = operation.send(:find_previous_transfers,
                               transfer: parent_transfer,
                               params: { transfer: parent_transfer, all_in_series: false })
        expect(result).to be_success

        previous_transfers = result.value!
        expect(previous_transfers).to include(child_transfer_1, child_transfer_2)
        expect(previous_transfers).not_to include(past_transfer, parent_transfer)
      end

      it 'returns only future transfers when all_in_series is not specified' do
        result = operation.send(:find_previous_transfers,
                               transfer: parent_transfer,
                               params: { transfer: parent_transfer })
        expect(result).to be_success

        previous_transfers = result.value!
        expect(previous_transfers).to include(child_transfer_1, child_transfer_2)
        expect(previous_transfers).not_to include(past_transfer, parent_transfer)
      end
    end
  end

  describe '#update_effective_parent' do
    let(:parent_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today)
    end

    let(:child_transfer_1) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 1.month,
             parent_id: parent_transfer.id)
    end

    let(:child_transfer_2) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 2.months,
             parent_id: parent_transfer.id)
    end

    let(:previous_transfers) { Transactions::Transfer.where(id: [child_transfer_1.id, child_transfer_2.id]) }

    before do
      parent_transfer
      child_transfer_1
      child_transfer_2
    end

    it 'updates effective_parent_id for all previous transfers' do
      result = operation.send(:update_effective_parent,
                             transfer: parent_transfer,
                             previous_transfers: previous_transfers)
      expect(result).to be_success

      child_transfer_1.reload
      child_transfer_2.reload
      expect(child_transfer_1.effective_parent_id).to eq(parent_transfer.id)
      expect(child_transfer_2.effective_parent_id).to eq(parent_transfer.id)
    end
  end

  describe '#clear_schedules_from_series' do
    let(:parent_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today,
             schedule: { "interval" => 1, "frequency" => "monthly" })
    end

    let(:child_transfer_1) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 1.month,
             parent_id: parent_transfer.id,
             schedule: { "interval" => 1, "frequency" => "monthly" })
    end

    let(:child_transfer_2) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 2.months,
             parent_id: parent_transfer.id,
             schedule: { "interval" => 1, "frequency" => "monthly" })
    end

    before do
      parent_transfer
      child_transfer_1
      child_transfer_2
    end

    it 'clears schedules from all transfers in series except the reference transfer' do
      result = operation.send(:clear_schedules_from_series, transfer: parent_transfer)
      expect(result).to be_success

      child_transfer_1.reload
      child_transfer_2.reload
      expect(child_transfer_1.schedule).to eq({})
      expect(child_transfer_2.schedule).to eq({})
      # Parent transfer schedule should remain unchanged
      expect(parent_transfer.reload.schedule).to eq({ "interval" => 1, "frequency" => "monthly" })
    end
  end

  describe '#find_pending_transfers' do
    let(:parent_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today)
    end

    let(:pending_transfer) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 1.month,
             parent_id: parent_transfer.id,
             balance_state: "pending")
    end

    let(:calculated_transfer) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 2.months,
             parent_id: parent_transfer.id,
             balance_state: "calculated")
    end

    let(:previous_transfers) { Transactions::Transfer.where(id: [pending_transfer.id, calculated_transfer.id]) }

    before do
      parent_transfer
      pending_transfer
      calculated_transfer
    end

    it 'returns only pending transfers' do
      result = operation.send(:find_pending_transfers, previous_transfers: previous_transfers)
      expect(result).to be_success

      pending_transfers = result.value!
      expect(pending_transfers).to include(pending_transfer)
      expect(pending_transfers).not_to include(calculated_transfer)
    end
  end

  describe '#find_calculated_transfers' do
    let(:parent_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today)
    end

    let(:pending_transfer) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 1.month,
             parent_id: parent_transfer.id,
             balance_state: "pending")
    end

    let(:calculated_transfer) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 2.months,
             parent_id: parent_transfer.id,
             balance_state: "calculated")
    end

    let(:previous_transfers) { Transactions::Transfer.where(id: [pending_transfer.id, calculated_transfer.id]) }

    before do
      parent_transfer
      pending_transfer
      calculated_transfer
    end

    it 'returns only calculated transfers' do
      result = operation.send(:find_calculated_transfers, previous_transfers: previous_transfers)
      expect(result).to be_success

      calculated_transfers = result.value!
      expect(calculated_transfers).to include(calculated_transfer)
      expect(calculated_transfers).not_to include(pending_transfer)
    end
  end

  describe '#delete_pending_transfers' do
    let(:parent_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today)
    end

    let(:pending_transfer_1) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 1.month,
             parent_id: parent_transfer.id,
             balance_state: "pending")
    end

    let(:pending_transfer_2) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 2.months,
             parent_id: parent_transfer.id,
             balance_state: "pending")
    end

    let(:pending_transfers) { Transactions::Transfer.where(id: [pending_transfer_1.id, pending_transfer_2.id]) }
    let(:delete_this_transfer_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisTransfer) }

    before do
      parent_transfer
      pending_transfer_1
      pending_transfer_2

      allow(Transactions::Operations::Transfers::DeleteThisTransfer).to receive(:new).and_return(delete_this_transfer_operation)
      allow(delete_this_transfer_operation).to receive(:call).and_return(Success())
    end

    it 'calls DeleteThisTransfer for each pending transfer' do
      expect(delete_this_transfer_operation).to receive(:call).with(transfer: pending_transfer_1).and_return(Success())
      expect(delete_this_transfer_operation).to receive(:call).with(transfer: pending_transfer_2).and_return(Success())

      result = operation.send(:delete_pending_transfers, pending_transfers: pending_transfers)
      expect(result).to be_success
    end

    it 'returns success' do
      result = operation.send(:delete_pending_transfers, pending_transfers: pending_transfers)
      expect(result).to be_success
    end
  end

  describe '#delete_calculated_transfers' do
    let(:parent_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today)
    end

    let(:calculated_transfer_1) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 1.month,
             parent_id: parent_transfer.id,
             balance_state: "calculated")
    end

    let(:calculated_transfer_2) do
      create(:transfer,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today + 2.months,
             parent_id: parent_transfer.id,
             balance_state: "calculated")
    end

    let(:calculated_transfers) { Transactions::Transfer.where(id: [calculated_transfer_1.id, calculated_transfer_2.id]) }
    let(:delete_this_transfer_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisTransfer) }

    before do
      parent_transfer
      calculated_transfer_1
      calculated_transfer_2

      allow(Transactions::Operations::Transfers::DeleteThisTransfer).to receive(:new).and_return(delete_this_transfer_operation)
      allow(delete_this_transfer_operation).to receive(:call).and_return(Success())
    end

    it 'calls DeleteThisTransfer for each calculated transfer' do
      expect(delete_this_transfer_operation).to receive(:call).with(transfer: calculated_transfer_1).and_return(Success())
      expect(delete_this_transfer_operation).to receive(:call).with(transfer: calculated_transfer_2).and_return(Success())

      result = operation.send(:delete_calculated_transfers, calculated_transfers: calculated_transfers)
      expect(result).to be_success
    end

    it 'returns success' do
      result = operation.send(:delete_calculated_transfers, calculated_transfers: calculated_transfers)
      expect(result).to be_success
    end
  end

  describe '#recreate_past_to_present_transfers' do
    let(:parent_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today - 1.day)
    end

    let(:create_repeat_transfers_operation) { instance_double(Transactions::Operations::Transfers::CreateRepeatTransfers) }

    before do
      parent_transfer

      allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_transfers_operation)
      allow(create_repeat_transfers_operation).to receive(:call).and_return(Success())
    end

    context 'when transfer is one_time' do
      it 'returns success without calling CreateRepeatTransfers' do
        one_time_transfer = create(:transfer,
                                  user:,
                                  space:,
                                  from_account:,
                                  to_account:,
                                  schedule_type: "one_time",
                                  date: today - 1.day)

        expect(create_repeat_transfers_operation).not_to receive(:call)

        result = operation.send(:recreate_past_to_present_transfers, transfer: one_time_transfer)
        expect(result).to be_success
      end
    end

    context 'when transfer date is in the future' do
      it 'returns success without calling CreateRepeatTransfers' do
        future_transfer = create(:transfer, :repeat,
                                user:,
                                space:,
                                from_account:,
                                to_account:,
                                date: today + 1.day)

        expect(create_repeat_transfers_operation).not_to receive(:call)

        result = operation.send(:recreate_past_to_present_transfers, transfer: future_transfer)
        expect(result).to be_success
      end
    end

    context 'when transfer is repeat and date is in the past' do
      it 'calls CreateRepeatTransfers with correct parameters' do
        expect(create_repeat_transfers_operation).to receive(:call).with(params: {
          transfer: parent_transfer,
          balance_state: "calculated",
          date_start: today.to_datetime,
          date_end: today
        }).and_return(Success())

        result = operation.send(:recreate_past_to_present_transfers, transfer: parent_transfer)
        expect(result).to be_success
      end
    end
  end

  describe '#recreate_future_transfers' do
    let(:parent_transfer) do
      create(:transfer, :repeat,
             user:,
             space:,
             from_account:,
             to_account:,
             date: today)
    end

    let(:create_repeat_transfers_operation) { instance_double(Transactions::Operations::Transfers::CreateRepeatTransfers) }

    before do
      parent_transfer

      allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_transfers_operation)
      allow(create_repeat_transfers_operation).to receive(:call).and_return(Success())
    end

    context 'when transfer is one_time' do
      it 'returns success without calling CreateRepeatTransfers' do
        one_time_transfer = create(:transfer,
                                  user:,
                                  space:,
                                  from_account:,
                                  to_account:,
                                  schedule_type: "one_time")

        expect(create_repeat_transfers_operation).not_to receive(:call)

        result = operation.send(:recreate_future_transfers, transfer: one_time_transfer)
        expect(result).to be_success
      end
    end

    context 'when transfer is repeat' do
      it 'calls CreateRepeatTransfers with correct parameters' do
        expect(create_repeat_transfers_operation).to receive(:call).with(params: {
          transfer: parent_transfer,
          balance_state: "pending",
          date_start: today + 1.day,
          date_end: today + 1.month
        }).and_return(Success())

        result = operation.send(:recreate_future_transfers, transfer: parent_transfer)
        expect(result).to be_success
      end
    end
  end
end
