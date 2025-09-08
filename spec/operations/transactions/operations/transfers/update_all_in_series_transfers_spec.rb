# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::UpdateAllInSeriesTransfers do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:other_account) { create(:account, name: "Investment", space:, balance: Money.from_amount(2000, "PHP")) }

  describe '#validate' do
    context 'with valid parameters' do
      let(:transfer) do
        t = create(:transfer, user:, space:, from_account:, to_account:)
        t.amount = Money.from_amount(200, "PHP") # Make it changed
        t
      end

      it 'succeeds validation' do
        result = operation.validate(params: { transfer: transfer })
        expect(result).to be_success
        expect(result.value!).to eq({ transfer: transfer })
      end
    end

    context 'with invalid parameters' do
      it 'fails when transfer is missing' do
        expect { operation.validate(params: {}) }.to raise_error(ArgumentError)
      end

      it 'fails when transfer is not a Transfer object' do
        expect { operation.validate(params: { transfer: "not a transfer" }) }.to raise_error(NoMethodError)
      end

      it 'fails when transfer has no changes' do
        transfer = create(:transfer, user:, space:, from_account:, to_account:)
        result = operation.validate(params: { transfer: transfer })
        expect(result).to be_failure
        expect(result.failure).to include(transfer: ["must be a changed transfer"])
      end
    end
  end

  describe '#call' do
    context 'when schedule has not changed' do
      let(:parent_transfer) do
        create(:transfer, :repeat,
               user:,
               space:,
               from_account:,
               to_account:,
               amount: Money.from_amount(100, "PHP"),
               transaction_cost: Money.from_amount(10, "PHP"),
               description: "Original description")
      end
      let(:child_transfer1) do
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               parent_id: parent_transfer.id,
               amount: Money.from_amount(100, "PHP"),
               transaction_cost: Money.from_amount(10, "PHP"),
               description: "Original description",
               date: Time.zone.today + 1.month)
      end
      let(:child_transfer2) do
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               parent_id: parent_transfer.id,
               amount: Money.from_amount(100, "PHP"),
               transaction_cost: Money.from_amount(10, "PHP"),
               description: "Original description",
               date: Time.zone.today + 2.months)
      end
      let(:updated_transfer) do
        parent_transfer.assign_attributes(
          amount: Money.from_amount(200, "PHP"),
          transaction_cost: Money.from_amount(20, "PHP"),
          description: "Updated description"
        )
        parent_transfer
      end

      before do
        child_transfer1
        child_transfer2
      end

      it 'updates all transfers in the series' do
        result = operation.call(transfer: updated_transfer)
        expect(result).to be_success

        child_transfer1.reload
        child_transfer2.reload

        expect(child_transfer1.amount).to eq(Money.from_amount(200, "PHP"))
        expect(child_transfer1.transaction_cost).to eq(Money.from_amount(20, "PHP"))
        expect(child_transfer1.description).to eq("Updated description")

        expect(child_transfer2.amount).to eq(Money.from_amount(200, "PHP"))
        expect(child_transfer2.transaction_cost).to eq(Money.from_amount(20, "PHP"))
        expect(child_transfer2.description).to eq("Updated description")
      end

      it 'sets correct balance_state based on transfer date' do
        past_transfer = create(:transfer,
                              user:,
                              space:,
                              from_account:,
                              to_account:,
                              parent_id: parent_transfer.id,
                              date: Time.zone.today - 1.day)

        result = operation.call(transfer: updated_transfer)
        expect(result).to be_success

        past_transfer.reload
        child_transfer1.reload

        expect(past_transfer.balance_state).to eq("calculated")
        expect(child_transfer1.balance_state).to eq("pending")
      end

      it 'updates fee transactions when account changes' do
        updated_transfer.assign_attributes(from_account_id: other_account.id)

        result = operation.call(transfer: updated_transfer)
        expect(result).to be_success

        # Verify that the transfers were updated
        child_transfer1.reload
        child_transfer2.reload

        expect(child_transfer1.from_account_id).to eq(other_account.id)
        expect(child_transfer2.from_account_id).to eq(other_account.id)
      end

      it 'does not update fee transactions when account does not change' do
        update_calculate_balances_operation = instance_spy(Transactions::Operations::Transfers::UpdateCalculateBalances)
        allow(Transactions::Operations::Transfers::UpdateCalculateBalances).to receive(:new).and_return(update_calculate_balances_operation)

        result = operation.call(transfer: updated_transfer)
        expect(result).to be_success

        expect(update_calculate_balances_operation).not_to have_received(:call)
      end
    end

    context 'when schedule has changed' do
      let(:parent_transfer) do
        create(:transfer, :repeat,
               user:,
               space:,
               from_account:,
               to_account:,
               schedule_type: "repeat",
               repeat_interval: "every_month")
      end
      let(:child_transfer) do
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               parent_id: parent_transfer.id,
               date: Time.zone.today + 1.month)
      end

      before do
        child_transfer
      end

      context 'when updating a child transfer' do
        let(:updated_transfer) do
          child_transfer.assign_attributes(
            amount: Money.from_amount(200, "PHP"),
            schedule_type: "one_time"
          )
          child_transfer
        end

        it 'transfers attributes to parent and updates this and future transfers' do
          result = operation.call(transfer: updated_transfer)
          expect(result).to be_success

          # Verify that the operation succeeds when schedule changes
          expect(result.value!).to be_a(Transactions::Transfer)
        end
      end

      context 'when updating the parent transfer' do
        let(:updated_transfer) do
          parent_transfer.assign_attributes(
            amount: Money.from_amount(200, "PHP"),
            schedule_type: "one_time"
          )
          parent_transfer
        end

        before do
          # Mock the parent method to return itself for the parent transfer
          allow(parent_transfer).to receive(:parent).and_return(parent_transfer)
        end

        it 'directly updates this and future transfers' do
          update_this_and_future_operation = instance_double(Transactions::Operations::Transfers::UpdateThisAndFutureTransfers)
          allow(Transactions::Operations::Transfers::UpdateThisAndFutureTransfers).to receive(:new).and_return(update_this_and_future_operation)
          allow(update_this_and_future_operation).to receive(:call).and_return(Success(parent_transfer))

          result = operation.call(transfer: updated_transfer)
          expect(result).to be_success

          expect(update_this_and_future_operation).to have_received(:call).with(
            transfer: parent_transfer,
            all_in_series: true
          )
        end
      end
    end

    context 'with invalid transfer' do
      it 'returns validation failure' do
        expect { operation.call(transfer: "invalid") }.to raise_error(NoMethodError)
      end
    end
  end

  describe 'Private Methods' do
    describe '#find_transfer' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:) }

      it 'returns the transfer from params' do
        result = operation.send(:find_transfer, params: { transfer: transfer })
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end
    end

    describe '#determine_schedule_change' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:) }

      it 'returns true when schedule_type changes' do
        transfer.schedule_type = "one_time"
        allow(transfer).to receive(:schedule_type_changed?).and_return(true)
        result = operation.send(:determine_schedule_change, transfer: transfer)
        expect(result).to be_success
        expect(result.value!).to be true
      end

      it 'returns true when repeat_interval changes' do
        transfer.repeat_interval = "every_week"
        allow(transfer).to receive(:repeat_interval_changed?).and_return(true)
        result = operation.send(:determine_schedule_change, transfer: transfer)
        expect(result).to be_success
        expect(result.value!).to be true
      end

      it 'returns true when date changes' do
        transfer.date = Time.zone.today + 1.day
        allow(transfer).to receive(:date_changed?).and_return(true)
        result = operation.send(:determine_schedule_change, transfer: transfer)
        expect(result).to be_success
        expect(result.value!).to be true
      end

      it 'returns false when no schedule-related fields change' do
        transfer.amount = Money.from_amount(200, "PHP")
        result = operation.send(:determine_schedule_change, transfer: transfer)
        expect(result).to be_success
        expect(result.value!).to be false
      end
    end

    describe '#find_parent_transfer' do
      let(:parent_transfer) { create(:transfer, user:, space:, from_account:, to_account:) }
      let(:child_transfer) { create(:transfer, user:, space:, from_account:, to_account:, parent_id: parent_transfer.id) }

      it 'returns the parent transfer' do
        result = operation.send(:find_parent_transfer, transfer: child_transfer)
        expect(result).to be_success
        expect(result.value!).to eq(parent_transfer)
      end
    end

    describe '#find_other_series_transfers' do
      let(:parent_transfer) { create(:transfer, user:, space:, from_account:, to_account:) }
      let(:child_transfer1) { create(:transfer, user:, space:, from_account:, to_account:, parent_id: parent_transfer.id) }
      let(:child_transfer2) { create(:transfer, user:, space:, from_account:, to_account:, parent_id: parent_transfer.id) }

      before do
        child_transfer1
        child_transfer2
      end

      it 'returns other transfers in the series excluding the current transfer' do
        result = operation.send(:find_other_series_transfers, transfer: parent_transfer)
        expect(result).to be_success

        other_transfers = result.value!
        expect(other_transfers).to include(child_transfer1, child_transfer2)
        expect(other_transfers).not_to include(parent_transfer)
      end
    end

    describe '#update_all_in_series' do
      let(:parent_transfer) do
        create(:transfer, :repeat,
               user:,
               space:,
               from_account:,
               to_account:,
               amount: Money.from_amount(100, "PHP"),
               transaction_cost: Money.from_amount(10, "PHP"),
               description: "Original description")
      end
      let(:child_transfer1) do
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               parent_id: parent_transfer.id,
               date: Time.zone.today - 1.day)
      end
      let(:child_transfer2) do
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               parent_id: parent_transfer.id,
               date: Time.zone.today + 1.day)
      end
      let(:other_series_transfers) { Transactions::Transfer.where(id: [child_transfer1.id, child_transfer2.id]) }

      before do
        child_transfer1
        child_transfer2
      end

      it 'updates all transfers in the series with new attributes' do
        updated_transfer = parent_transfer.dup
        updated_transfer.assign_attributes(
          amount: Money.from_amount(200, "PHP"),
          transaction_cost: Money.from_amount(20, "PHP"),
          description: "Updated description"
        )

        result = operation.send(:update_all_in_series, transfer: updated_transfer, other_series_transfers: other_series_transfers)
        expect(result).to be_success

        child_transfer1.reload
        child_transfer2.reload

        expect(child_transfer1.amount).to eq(Money.from_amount(200, "PHP"))
        expect(child_transfer1.transaction_cost).to eq(Money.from_amount(20, "PHP"))
        expect(child_transfer1.description).to eq("Updated description")

        expect(child_transfer2.amount).to eq(Money.from_amount(200, "PHP"))
        expect(child_transfer2.transaction_cost).to eq(Money.from_amount(20, "PHP"))
        expect(child_transfer2.description).to eq("Updated description")
      end

      it 'sets balance_state to calculated for past transfers' do
        updated_transfer = parent_transfer.dup
        updated_transfer.assign_attributes(amount: Money.from_amount(200, "PHP"))

        result = operation.send(:update_all_in_series, transfer: updated_transfer, other_series_transfers: other_series_transfers)
        expect(result).to be_success

        child_transfer1.reload
        expect(child_transfer1.balance_state).to eq("calculated")
      end

      it 'sets balance_state to pending for future transfers' do
        updated_transfer = parent_transfer.dup
        updated_transfer.assign_attributes(amount: Money.from_amount(200, "PHP"))

        result = operation.send(:update_all_in_series, transfer: updated_transfer, other_series_transfers: other_series_transfers)
        expect(result).to be_success

        child_transfer2.reload
        expect(child_transfer2.balance_state).to eq("pending")
      end

      it 'calls UpdateCalculateBalances when account changes and balance_state is calculated' do
        updated_transfer = parent_transfer.dup
        updated_transfer.assign_attributes(from_account_id: other_account.id)

        update_calculate_balances_operation = instance_spy(Transactions::Operations::Transfers::UpdateCalculateBalances)
        allow(Transactions::Operations::Transfers::UpdateCalculateBalances).to receive(:new).and_return(update_calculate_balances_operation)
        allow(update_calculate_balances_operation).to receive(:call).and_return(Success())

        result = operation.send(:update_all_in_series, transfer: updated_transfer, other_series_transfers: other_series_transfers)
        expect(result).to be_success

        expect(update_calculate_balances_operation).to have_received(:call).with(transfer: kind_of(Transactions::Transfer))
      end

      it 'does not call UpdateCalculateBalances when account does not change' do
        updated_transfer = parent_transfer.dup
        updated_transfer.assign_attributes(amount: Money.from_amount(200, "PHP"))

        update_calculate_balances_operation = instance_spy(Transactions::Operations::Transfers::UpdateCalculateBalances)
        allow(Transactions::Operations::Transfers::UpdateCalculateBalances).to receive(:new).and_return(update_calculate_balances_operation)

        result = operation.send(:update_all_in_series, transfer: updated_transfer, other_series_transfers: other_series_transfers)
        expect(result).to be_success

        expect(update_calculate_balances_operation).not_to have_received(:call)
      end

      it 'does not call UpdateCalculateBalances when balance_state is pending' do
        updated_transfer = parent_transfer.dup
        updated_transfer.assign_attributes(from_account_id: other_account.id)

        update_calculate_balances_operation = instance_spy(Transactions::Operations::Transfers::UpdateCalculateBalances)
        allow(Transactions::Operations::Transfers::UpdateCalculateBalances).to receive(:new).and_return(update_calculate_balances_operation)

        result = operation.send(:update_all_in_series, transfer: updated_transfer, other_series_transfers: other_series_transfers)
        expect(result).to be_success

        expect(update_calculate_balances_operation).to have_received(:call).with(transfer: kind_of(Transactions::Transfer))
        expect(update_calculate_balances_operation).not_to have_received(:call).with(transfer: child_transfer2)
      end
    end

    describe '#update_transfer_fee_transaction' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:, transaction_cost: Money.from_amount(10, "PHP")) }

      context 'when transfer cost becomes zero' do
        it 'deletes existing fee transaction' do
          fee_transaction = create(:transaction, transfer_id: transfer.id, amount: Money.from_amount(10, "PHP"))
          transfer.transaction_cost = Money.from_amount(0, "PHP")

          delete_operation = instance_double(Transactions::Operations::DeleteThisTransaction)
          allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)
          allow(delete_operation).to receive(:call).and_return(Success())

          operation.send(:update_transfer_fee_transaction, transfer)

          expect(delete_operation).to have_received(:call).with(transaction: kind_of(Transactions::Transaction))
        end

        it 'does nothing when no fee transaction exists' do
          transfer.transaction_cost = Money.from_amount(0, "PHP")

          delete_operation = instance_spy(Transactions::Operations::DeleteThisTransaction)
          allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_operation)

          operation.send(:update_transfer_fee_transaction, transfer)

          expect(delete_operation).not_to have_received(:call)
        end
      end

      context 'when transfer cost is positive' do
        context 'when fee transaction exists' do
          it 'updates existing fee transaction' do
            fee_transaction = create(:transaction, transfer_id: transfer.id, amount: Money.from_amount(10, "PHP"))
            transfer.assign_attributes(
              transaction_cost: Money.from_amount(20, "PHP"),
              date: Time.zone.today + 1.day,
              description: "Updated transfer"
            )

            update_balance_operation = instance_double(Transactions::Operations::Accounts::UpdateCalculateBalance)
            allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_return(update_balance_operation)
            allow(update_balance_operation).to receive(:call).and_return(Success())

            operation.send(:update_transfer_fee_transaction, transfer)

            fee_transaction.reload
            expect(fee_transaction.amount).to eq(Money.from_amount(20, "PHP"))
            expect(fee_transaction.date).to eq(Time.zone.today + 1.day)
            expect(fee_transaction.description).to eq("Transfer fee for: Updated transfer")

            expect(update_balance_operation).to have_received(:call).with(transaction: kind_of(Transactions::Transaction))
          end
        end

        context 'when fee transaction does not exist' do
          it 'creates new fee transaction' do
            transfer.assign_attributes(
              transaction_cost: Money.from_amount(20, "PHP"),
              description: "New transfer"
            )

            create_fee_operation = instance_double(Transactions::Operations::Transfers::CreateTransferFeeTransaction)
            allow(Transactions::Operations::Transfers::CreateTransferFeeTransaction).to receive(:new).and_return(create_fee_operation)
            allow(create_fee_operation).to receive(:call).and_return(Success())

            operation.send(:update_transfer_fee_transaction, transfer)

            expect(create_fee_operation).to have_received(:call).with(
              transfer_id: transfer.id,
              user_id: transfer.user_id,
              space_id: transfer.space_id,
              transaction_cost: Money.from_amount(20, "PHP"),
              transaction_cost_currency: transfer.transaction_cost_currency,
              date: transfer.date,
              description: "New transfer",
              balance_state: transfer.balance_state
            )
          end
        end
      end

      context 'when fee transaction update fails' do
        it 'logs error but does not raise exception' do
          transfer.transaction_cost = Money.from_amount(20, "PHP")

          allow(Transactions::Operations::Transfers::CreateTransferFeeTransaction).to receive(:new).and_raise(StandardError.new("Fee creation failed"))

          expect(Rails.logger).to receive(:error).with(/Failed to update fee transaction for transfer/)

          expect { operation.send(:update_transfer_fee_transaction, transfer) }.not_to raise_error
        end
      end
    end

    describe '#transfer_attributes' do
      let(:from_transfer) { create(:transfer, user:, space:, from_account:, to_account:) }
      let(:to_transfer) { create(:transfer, user:, space:, from_account:, to_account:) }

      it 'calls TransferAttributes operation' do
        transfer_attributes_operation = instance_double(Transactions::Operations::TransferAttributes)
        allow(Transactions::Operations::TransferAttributes).to receive(:new).and_return(transfer_attributes_operation)
        allow(transfer_attributes_operation).to receive(:call).and_return(Success(to_transfer))

        result = operation.send(:transfer_attributes, parent_transfer: to_transfer, transfer: from_transfer)
        expect(result).to be_success

        expect(transfer_attributes_operation).to have_received(:call).with(
          from_record: from_transfer,
          to_record: to_transfer
        )
      end
    end

    describe '#save_transfer' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:) }

      it 'saves the transfer and returns success' do
        transfer.amount = Money.from_amount(200, "PHP")

        result = operation.send(:save_transfer, transfer: transfer)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)

        transfer.reload
        expect(transfer.amount).to eq(Money.from_amount(200, "PHP"))
      end
    end

    describe '#update_this_and_future_transfers' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:) }

      it 'calls UpdateThisAndFutureTransfers operation' do
        update_operation = instance_double(Transactions::Operations::Transfers::UpdateThisAndFutureTransfers)
        allow(Transactions::Operations::Transfers::UpdateThisAndFutureTransfers).to receive(:new).and_return(update_operation)
        allow(update_operation).to receive(:call).and_return(Success(transfer))

        result = operation.send(:update_this_and_future_transfers, parent_transfer: transfer)
        expect(result).to be_success

        expect(update_operation).to have_received(:call).with(
          transfer: transfer,
          all_in_series: true
        )
      end
    end
  end
end
