# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::UpdateTransfer do
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
           description: "Original transfer",
           schedule_type: "one_time",
           balance_state: "calculated")
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when id is missing' do
        result = operation.validate(params: { user_id: user.id.to_s, space_id: space.id.to_s })
        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end

      it 'fails when user_id is missing' do
        result = operation.validate(params: { id: transfer.id.to_s, space_id: space.id.to_s })
        expect(result).to be_failure
        expect(result.failure).to include(:user_id)
      end

      it 'fails when space_id is missing' do
        result = operation.validate(params: { id: transfer.id.to_s, user_id: user.id.to_s })
        expect(result).to be_failure
        expect(result.failure).to include(:space_id)
      end

      it 'fails when amount is missing' do
        result = operation.validate(params: { id: transfer.id.to_s, user_id: user.id.to_s, space_id: space.id.to_s })
        expect(result).to be_failure
        expect(result.failure).to include(:amount)
      end
    end

    context 'with invalid parameters' do
      it 'fails when amount is not greater than 0' do
        result = operation.validate(params: {
          id: transfer.id.to_s,
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          amount: 0,
          transaction_cost: 10,
          date: Time.zone.today,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          schedule_type: "one_time"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:amount)
      end

      it 'fails when transaction_cost is negative' do
        result = operation.validate(params: {
          id: transfer.id.to_s,
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          amount: 100,
          transaction_cost: -1,
          date: Time.zone.today,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          schedule_type: "one_time"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction_cost)
      end

      it 'fails when schedule_type is invalid' do
        result = operation.validate(params: {
          id: transfer.id.to_s,
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          amount: 100,
          transaction_cost: 10,
          date: Time.zone.today,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          schedule_type: "invalid_type"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:schedule_type)
      end

      it 'fails when repeat_interval is missing for repeat schedule_type' do
        result = operation.validate(params: {
          id: transfer.id.to_s,
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          amount: 100,
          transaction_cost: 10,
          date: Time.zone.today,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          schedule_type: "repeat"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:repeat_interval)
      end

      it 'fails when update_scope is invalid' do
        result = operation.validate(params: {
          id: transfer.id.to_s,
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          amount: 100,
          transaction_cost: 10,
          date: Time.zone.today,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          schedule_type: "one_time",
          update_scope: "invalid_scope"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:update_scope)
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation for one_time transfer' do
        result = operation.validate(params: {
          id: transfer.id.to_s,
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          amount: 100,
          transaction_cost: 10,
          date: Time.zone.today,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          schedule_type: "one_time"
        })
        expect(result).to be_success
      end

      it 'succeeds validation for repeat transfer' do
        result = operation.validate(params: {
          id: transfer.id.to_s,
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          amount: 100,
          transaction_cost: 10,
          date: Time.zone.today,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          schedule_type: "repeat",
          repeat_interval: "every_month"
        })
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    let(:valid_params) do
      {
        id: transfer.id.to_s,
        user_id: user.id.to_s,
        space_id: space.id.to_s,
        amount: 150.00,
        transaction_cost: 15.00,
        date: Time.zone.today,
        from_account_name: from_account.name,
        to_account_name: to_account.name,
        description: "Updated transfer",
        schedule_type: "one_time"
      }
    end

    context 'with valid parameters' do
      it 'updates transfer successfully' do
        result = operation.call(valid_params)
        expect(result).to be_success

        updated_transfer = result.value!
        expect(updated_transfer.amount).to eq(Money.from_amount(150.00, "PHP"))
        expect(updated_transfer.transaction_cost).to eq(Money.from_amount(15.00, "PHP"))
        expect(updated_transfer.description).to eq("Updated transfer")
      end

      it 'updates account balances when transfer is calculated' do
        update_calculate_balances_operation = instance_double(Transactions::Operations::Transfers::UpdateCalculateBalances)
        allow(Transactions::Operations::Transfers::UpdateCalculateBalances).to receive(:new).and_return(update_calculate_balances_operation)
        allow(update_calculate_balances_operation).to receive(:call).and_return(Success())

        result = operation.call(valid_params)
        expect(result).to be_success

        expect(update_calculate_balances_operation).to have_received(:call).with(transfer: kind_of(Transactions::Transfer))
      end

      it 'does not update balances when transfer is pending' do
        pending_transfer = create(:transfer,
                                 user:,
                                 space:,
                                 from_account:,
                                 to_account:,
                                 balance_state: "pending")

        params = valid_params.merge(id: pending_transfer.id.to_s)
        update_calculate_balances_operation = instance_spy(Transactions::Operations::Transfers::UpdateCalculateBalances)
        allow(Transactions::Operations::Transfers::UpdateCalculateBalances).to receive(:new).and_return(update_calculate_balances_operation)

        result = operation.call(params)
        expect(result).to be_success

        expect(update_calculate_balances_operation).not_to have_received(:call)
      end

      it 'updates transfer fee transaction when transaction cost changes' do
        # Create a fee transaction first
        fee_transaction = create(:transaction, transfer_id: transfer.id, amount: Money.from_amount(10, "PHP"))

        result = operation.call(valid_params)
        expect(result).to be_success

        # Verify that the fee transaction was updated
        fee_transaction.reload
        expect(fee_transaction.amount).to eq(Money.from_amount(15.00, "PHP"))
      end

      it 'deletes fee transaction when transaction cost becomes zero' do
        params_without_fee = valid_params.merge(transaction_cost: 0)

        result = operation.call(params_without_fee)
        expect(result).to be_success

        # Verify that the fee transaction was deleted
        fee_transaction = Transactions::Transaction.find_by(transfer_id: transfer.id)
        expect(fee_transaction).to be_nil
      end

      it 'creates new fee transaction when none exists' do
        # Create a transfer without fee transaction
        transfer_without_fee = create(:transfer,
                                     user:,
                                     space:,
                                     from_account:,
                                     to_account:,
                                     transaction_cost: Money.from_amount(0, "PHP"))

        params = valid_params.merge(id: transfer_without_fee.id.to_s, transaction_cost: 20.00)
        create_fee_operation = instance_double(Transactions::Operations::Transfers::CreateTransferFeeTransaction)
        allow(Transactions::Operations::Transfers::CreateTransferFeeTransaction).to receive(:new).and_return(create_fee_operation)
        allow(create_fee_operation).to receive(:call).and_return(Success())

        result = operation.call(params)
        expect(result).to be_success

        expect(create_fee_operation).to have_received(:call).with(
          transfer_id: transfer_without_fee.id,
          balance_state: "calculated",
          user_id: params[:user_id],
          space_id: params[:space_id],
          amount: params[:amount],
          amount_currency: "PHP",
          transaction_cost: params[:transaction_cost],
          transaction_cost_currency: "PHP",
          date: params[:date],
          description: params[:description],
          from_account_id: kind_of(String),
          to_account_id: kind_of(String),
          schedule_type: params[:schedule_type],
          id: transfer_without_fee.id
        )
      end
    end

    context 'with schedule updates' do
      it 'updates schedule when schedule_type changes' do
        params = valid_params.merge(schedule_type: "repeat", repeat_interval: "every_month")

        result = operation.call(params)
        expect(result).to be_success

        updated_transfer = result.value!
        expect(updated_transfer.schedule_type).to eq("repeat")
        expect(updated_transfer.repeat_interval).to eq("every_month")
        expect(updated_transfer.schedule).to be_present
      end

      it 'creates empty schedule for one_time transfer' do
        repeat_transfer = create(:transfer, :repeat, user:, space:, from_account:, to_account:)
        params = valid_params.merge(id: repeat_transfer.id.to_s, schedule_type: "one_time")

        result = operation.call(params)
        expect(result).to be_success

        updated_transfer = result.value!
        expect(updated_transfer.schedule_type).to eq("one_time")
        expect(updated_transfer.schedule).to eq({})
      end

      it 'forces schedule creation for this_and_future updates' do
        params = valid_params.merge(update_scope: "this_and_future")

        result = operation.call(params)
        expect(result).to be_success

        updated_transfer = result.value!
        # For one_time transfers, schedule will be empty even when forced
        expect(updated_transfer.schedule).to eq({})
      end
    end

    context 'with update_scope' do
      it 'calls UpdateRepeatTransfers when update_scope is provided and transfer changed' do
        params = valid_params.merge(update_scope: "this_and_future")
        update_repeat_transfers_operation = instance_double(Transactions::Operations::Transfers::UpdateRepeatTransfers)
        allow(Transactions::Operations::Transfers::UpdateRepeatTransfers).to receive(:new).and_return(update_repeat_transfers_operation)
        allow(update_repeat_transfers_operation).to receive(:call).and_return(Success(transfer))

        result = operation.call(params)
        expect(result).to be_success

        expect(update_repeat_transfers_operation).to have_received(:call).with(
          transfer: kind_of(Transactions::Transfer),
          update_scope: "this_and_future"
        )
      end

      it 'does not call UpdateRepeatTransfers when update_scope is not provided' do
        update_repeat_transfers_operation = instance_spy(Transactions::Operations::Transfers::UpdateRepeatTransfers)
        allow(Transactions::Operations::Transfers::UpdateRepeatTransfers).to receive(:new).and_return(update_repeat_transfers_operation)

        result = operation.call(valid_params)
        expect(result).to be_success

        expect(update_repeat_transfers_operation).not_to have_received(:call)
      end

      it 'does not call UpdateRepeatTransfers when transfer has not changed' do
        # Create a transfer with the same attributes as the update params
        unchanged_transfer = create(:transfer,
                                   user:,
                                   space:,
                                   from_account:,
                                   to_account:,
                                   amount: Money.from_amount(150, "PHP"),
                                   transaction_cost: Money.from_amount(15, "PHP"),
                                   description: "Updated transfer")

        # Use the exact same params to avoid any changes
        params = {
          id: unchanged_transfer.id.to_s,
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          amount: 150.00,
          transaction_cost: 15.00,
          date: unchanged_transfer.date.to_date,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          description: "Updated transfer",
          schedule_type: "one_time",
          update_scope: "this_and_future"
        }

        update_repeat_transfers_operation = instance_double(Transactions::Operations::Transfers::UpdateRepeatTransfers)
        allow(Transactions::Operations::Transfers::UpdateRepeatTransfers).to receive(:new).and_return(update_repeat_transfers_operation)
        allow(update_repeat_transfers_operation).to receive(:call).and_return(Success(unchanged_transfer))

        result = operation.call(params)
        expect(result).to be_success

        expect(update_repeat_transfers_operation).not_to have_received(:call)
      end
    end

    context 'with file attachment' do
      let(:file) { fixture_file_upload('test.txt', 'text/plain') }

      it 'attaches file when provided' do
        params = valid_params.merge(file: file)

        result = operation.call(params)
        expect(result).to be_success

        updated_transfer = result.value!
        expect(updated_transfer.files).to be_attached
      end

      it 'does not attach file when not provided' do
        result = operation.call(valid_params)
        expect(result).to be_success

        updated_transfer = result.value!
        expect(updated_transfer.files).not_to be_attached
      end
    end

    context 'with monthly summary update' do
      it 'calls update_monthly_summary after successful transfer update' do
        update_summary_operation = instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary)
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Success())

        result = operation.call(valid_params)
        expect(result).to be_success

        expect(update_summary_operation).to have_received(:call).with(
          space_id: transfer.space_id,
          transaction_date: transfer.date.to_date
        )
      end
    end

    context 'when date changes to a different month' do
      let(:old_date) { Date.new(2024, 3, 10) }
      let(:new_date) { Date.new(2024, 4, 20) }

      before do
        transfer.update!(date: old_date)
      end

      it 'recalculates the monthly summary for the old month' do
        update_summary_operation = instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary)
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Success())

        params = valid_params.merge(date: new_date)

        result = operation.call(params)
        expect(result).to be_success

        expect(update_summary_operation).to have_received(:call).with(
          space_id: transfer.space_id,
          transaction_date: old_date
        )
      end

      it 'recalculates the monthly summary for the new month' do
        update_summary_operation = instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary)
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Success())

        params = valid_params.merge(date: new_date)

        result = operation.call(params)
        expect(result).to be_success

        expect(update_summary_operation).to have_received(:call).with(
          space_id: transfer.space_id,
          transaction_date: new_date
        )
      end
    end

    context 'with invalid parameters' do
      it 'fails when transfer is not found' do
        params = valid_params.merge(id: "non-existent-id")

        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(id: "transfer not found")
      end

      it 'fails when from_account is not found' do
        params = valid_params.merge(from_account_name: "NonExistentAccount")

        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(from_account_name: "cannot be changed")
      end

      it 'fails when to_account is not found' do
        params = valid_params.merge(to_account_name: "NonExistentAccount")

        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(to_account_name: "cannot be changed")
      end

      it 'fails when account is discarded' do
        from_account.discard
        params = valid_params.merge(from_account_name: from_account.name)

        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(account_name: "'#{from_account.name}' not found")
      end
    end

    context 'when operations fail' do
      it 'propagates failure from UpdateCalculateBalances' do
        update_calculate_balances_operation = instance_double(Transactions::Operations::Transfers::UpdateCalculateBalances)
        allow(Transactions::Operations::Transfers::UpdateCalculateBalances).to receive(:new).and_return(update_calculate_balances_operation)
        allow(update_calculate_balances_operation).to receive(:call).and_return(Failure(error: "Balance update failed"))

        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end

      it 'propagates failure from UpdateRepeatTransfers' do
        params = valid_params.merge(update_scope: "this_and_future")
        update_repeat_transfers_operation = instance_double(Transactions::Operations::Transfers::UpdateRepeatTransfers)
        allow(Transactions::Operations::Transfers::UpdateRepeatTransfers).to receive(:new).and_return(update_repeat_transfers_operation)
        allow(update_repeat_transfers_operation).to receive(:call).and_return(Failure(error: "Repeat update failed"))

        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end

      it 'continues execution even when CreateTransferFeeTransaction fails' do
        transfer_without_fee = create(:transfer,
                                     user:,
                                     space:,
                                     from_account:,
                                     to_account:,
                                     transaction_cost: Money.from_amount(0, "PHP"))

        params = valid_params.merge(id: transfer_without_fee.id.to_s, transaction_cost: 20.00)
        create_fee_operation = instance_double(Transactions::Operations::Transfers::CreateTransferFeeTransaction)
        allow(Transactions::Operations::Transfers::CreateTransferFeeTransaction).to receive(:new).and_return(create_fee_operation)
        allow(create_fee_operation).to receive(:call).and_return(Failure(error: "Fee creation failed"))

        result = operation.call(params)
        expect(result).to be_success
        # The operation doesn't use step for CreateTransferFeeTransaction, so it continues
      end
    end
  end

  describe 'private methods' do
    describe '#find_transfer' do
      it 'finds transfer successfully' do
        result = operation.send(:find_transfer, params: { id: transfer.id.to_s, space_id: space.id.to_s })
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end

      it 'returns failure when transfer is not found' do
        result = operation.send(:find_transfer, params: { id: "non-existent-id", space_id: space.id.to_s })
        expect(result).to be_failure
        expect(result.failure).to include(id: "transfer not found")
      end
    end

    describe '#find_account' do
      it 'finds account successfully' do
        result = operation.send(:find_account, params: { space_id: space.id.to_s }, account_name: from_account.name)
        expect(result).to be_success
        expect(result.value!).to eq(from_account)
      end

      it 'returns failure when account is not found' do
        result = operation.send(:find_account, params: { space_id: space.id.to_s }, account_name: "NonExistentAccount")
        expect(result).to be_failure
        expect(result.failure).to include(account_name: "'NonExistentAccount' not found")
      end

      it 'returns failure when account is discarded' do
        from_account.discard
        result = operation.send(:find_account, params: { space_id: space.id.to_s }, account_name: from_account.name)
        expect(result).to be_failure
        expect(result.failure).to include(account_name: "'#{from_account.name}' not found")
      end
    end

    describe '#transform_params' do
      let(:params) do
        {
          id: transfer.id.to_s,
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          amount: 100.00,
          transaction_cost: 10.00,
          date: Time.zone.today,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          description: "Test transfer",
          schedule_type: "repeat",
          repeat_interval: "every_month"
        }
      end

      it 'transforms params correctly' do
        result = operation.send(:transform_params, params: params, from_account: from_account, to_account: to_account)
        expect(result).to be_success

        transformed = result.value!
        expect(transformed[:from_account_id]).to eq(from_account.id)
        expect(transformed[:to_account_id]).to eq(to_account.id)
        expect(transformed[:amount_currency]).to eq("PHP")
        expect(transformed[:transaction_cost_currency]).to eq("PHP")
        expect(transformed[:repeat_count]).to eq(1)
        expect(transformed).not_to have_key(:from_account_name)
        expect(transformed).not_to have_key(:to_account_name)
      end

      it 'sets repeat_count to 1 for repeat transfers' do
        result = operation.send(:transform_params, params: params, from_account: from_account, to_account: to_account)
        expect(result).to be_success

        transformed = result.value!
        expect(transformed[:repeat_count]).to eq(1)
      end

      it 'does not set repeat_count for one_time transfers' do
        one_time_params = params.merge(schedule_type: "one_time")
        result = operation.send(:transform_params, params: one_time_params, from_account: from_account, to_account: to_account)
        expect(result).to be_success

        transformed = result.value!
        expect(transformed[:repeat_count]).to be_nil # No repeat_count for one_time transfers
      end

      it 'does not modify original params' do
        original_params = params.dup
        operation.send(:transform_params, params: params, from_account: from_account, to_account: to_account)
        expect(params).to eq(original_params)
      end
    end

    describe '#initialize_update_transfer' do
      let(:params) do
        {
          amount: 200.00,
          transaction_cost: 20.00,
          description: "Updated description",
          schedule_type: "repeat",
          repeat_interval: "every_week"
        }
      end

      it 'assigns attributes to transfer' do
        result = operation.send(:initialize_update_transfer, transfer: transfer, params: params)
        expect(result).to be_success

        expect(transfer.amount).to eq(Money.from_amount(200.00, "PHP"))
        expect(transfer.transaction_cost).to eq(Money.from_amount(20.00, "PHP"))
        expect(transfer.description).to eq("Updated description")
        expect(transfer.schedule_type).to eq("repeat")
        expect(transfer.repeat_interval).to eq("every_week")
      end

      it 'excludes id, update_scope, and file from attributes' do
        params_with_excluded = params.merge(id: "new-id", update_scope: "this_and_future", file: "some_file")
        result = operation.send(:initialize_update_transfer, transfer: transfer, params: params_with_excluded)
        expect(result).to be_success

        expect(transfer.id).not_to eq("new-id")
        expect(transfer).not_to respond_to(:update_scope)
        expect(transfer).not_to respond_to(:file)
      end
    end

    describe '#adjust_balances' do
      it 'calls UpdateCalculateBalances when transfer is calculated and changed' do
        transfer.assign_attributes(amount: Money.from_amount(200, "PHP"))
        update_calculate_balances_operation = instance_double(Transactions::Operations::Transfers::UpdateCalculateBalances)
        allow(Transactions::Operations::Transfers::UpdateCalculateBalances).to receive(:new).and_return(update_calculate_balances_operation)
        allow(update_calculate_balances_operation).to receive(:call).and_return(Success())

        result = operation.send(:adjust_balances, transfer: transfer)
        expect(result).to be_success

        expect(update_calculate_balances_operation).to have_received(:call).with(transfer: transfer)
      end

      it 'does not call UpdateCalculateBalances when transfer is pending' do
        pending_transfer = create(:transfer, user:, space:, from_account:, to_account:, balance_state: "pending")
        pending_transfer.assign_attributes(amount: Money.from_amount(200, "PHP"))

        update_calculate_balances_operation = instance_spy(Transactions::Operations::Transfers::UpdateCalculateBalances)
        allow(Transactions::Operations::Transfers::UpdateCalculateBalances).to receive(:new).and_return(update_calculate_balances_operation)

        result = operation.send(:adjust_balances, transfer: pending_transfer)
        expect(result).to be_success

        expect(update_calculate_balances_operation).not_to have_received(:call)
      end

      it 'does not call UpdateCalculateBalances when transfer is not changed' do
        update_calculate_balances_operation = instance_spy(Transactions::Operations::Transfers::UpdateCalculateBalances)
        allow(Transactions::Operations::Transfers::UpdateCalculateBalances).to receive(:new).and_return(update_calculate_balances_operation)

        result = operation.send(:adjust_balances, transfer: transfer)
        expect(result).to be_success

        expect(update_calculate_balances_operation).not_to have_received(:call)
      end
    end

    describe '#update_schedule' do
      let(:params) { { update_scope: nil } }

      it 'creates schedule for repeat transfer' do
        transfer.assign_attributes(schedule_type: "repeat", repeat_interval: "every_month")
        params_with_repeat = params.merge(schedule_type: "repeat", repeat_interval: "every_month")

        result = operation.send(:update_schedule, transfer: transfer, params: params_with_repeat)
        expect(result).to be_success

        expect(transfer.schedule).to be_present
      end

      it 'creates empty schedule for one_time transfer' do
        transfer.assign_attributes(schedule_type: "one_time")
        params_with_one_time = params.merge(schedule_type: "one_time")

        result = operation.send(:update_schedule, transfer: transfer, params: params_with_one_time)
        expect(result).to be_success

        expect(transfer.schedule).to eq({})
      end

      it 'forces schedule creation for this_and_future updates' do
        params_with_scope = params.merge(update_scope: "this_and_future")

        result = operation.send(:update_schedule, transfer: transfer, params: params_with_scope)
        expect(result).to be_success

        # For one_time transfers, schedule will be empty even when forced
        expect(transfer.schedule).to eq({})
      end

      it 'does not update schedule when no changes are needed' do
        result = operation.send(:update_schedule, transfer: transfer, params: params)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end

      it 'handles schedule creation errors' do
        allow(Utils::Recurrence).to receive(:schedule).and_raise(StandardError.new("Schedule error"))
        transfer.assign_attributes(schedule_type: "repeat", repeat_interval: "every_month")
        params_with_repeat = params.merge(schedule_type: "repeat", repeat_interval: "every_month")

        result = operation.send(:update_schedule, transfer: transfer, params: params_with_repeat)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end

    describe '#update_transfer_fee_transaction' do
      let(:params) { { user_id: user.id.to_s, space_id: space.id.to_s } }

      it 'updates existing fee transaction' do
        # Create a fee transaction first
        fee_transaction = create(:transaction, transfer_id: transfer.id, amount: Money.from_amount(10, "PHP"))
        transfer.assign_attributes(transaction_cost: Money.from_amount(20, "PHP"))

        result = operation.send(:update_transfer_fee_transaction, transfer: transfer, params: params)
        expect(result).to be_success

        fee_transaction.reload
        expect(fee_transaction.amount).to eq(Money.from_amount(20, "PHP"))
      end

      it 'deletes fee transaction when transaction cost becomes zero' do
        transfer.assign_attributes(transaction_cost: Money.from_amount(0, "PHP"))

        result = operation.send(:update_transfer_fee_transaction, transfer: transfer, params: params)
        expect(result).to be_success

        fee_transaction = Transactions::Transaction.find_by(transfer_id: transfer.id)
        expect(fee_transaction).to be_nil
      end

      it 'creates new fee transaction when none exists' do
        transfer_without_fee = create(:transfer,
                                     user:,
                                     space:,
                                     from_account:,
                                     to_account:,
                                     transaction_cost: Money.from_amount(0, "PHP"))
        transfer_without_fee.assign_attributes(transaction_cost: Money.from_amount(20, "PHP"))

        create_fee_operation = instance_double(Transactions::Operations::Transfers::CreateTransferFeeTransaction)
        allow(Transactions::Operations::Transfers::CreateTransferFeeTransaction).to receive(:new).and_return(create_fee_operation)
        allow(create_fee_operation).to receive(:call).and_return(Success())

        result = operation.send(:update_transfer_fee_transaction, transfer: transfer_without_fee, params: params)
        expect(result).to be_success

        expect(create_fee_operation).to have_received(:call).with(
          transfer_id: transfer_without_fee.id,
          balance_state: "calculated",
          **params
        )
      end

      it 'handles fee transaction update errors' do
        # Create a fee transaction first
        fee_transaction = create(:transaction, transfer_id: transfer.id, amount: Money.from_amount(10, "PHP"))
        allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_raise(StandardError.new("Update error"))
        transfer.assign_attributes(transaction_cost: Money.from_amount(20, "PHP"))

        result = operation.send(:update_transfer_fee_transaction, transfer: transfer, params: params)
        expect(result).to be_failure
        expect(result.failure).to include(:fee_transaction)
      end
    end

    describe '#update_repeat_transfers' do
      let(:params) { { update_scope: "this_and_future" } }

      it 'calls UpdateRepeatTransfers when update_scope is provided and transfer changed' do
        transfer.assign_attributes(amount: Money.from_amount(200, "PHP"))
        update_repeat_transfers_operation = instance_double(Transactions::Operations::Transfers::UpdateRepeatTransfers)
        allow(Transactions::Operations::Transfers::UpdateRepeatTransfers).to receive(:new).and_return(update_repeat_transfers_operation)
        allow(update_repeat_transfers_operation).to receive(:call).and_return(Success(transfer))

        result = operation.send(:update_repeat_transfers, transfer: transfer, params: params)
        expect(result).to be_success

        expect(update_repeat_transfers_operation).to have_received(:call).with(
          transfer: transfer,
          update_scope: "this_and_future"
        )
      end

      it 'returns transfer when update_scope is not provided' do
        params_without_scope = { update_scope: nil }

        result = operation.send(:update_repeat_transfers, transfer: transfer, params: params_without_scope)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end

      it 'returns transfer when transfer has not changed' do
        result = operation.send(:update_repeat_transfers, transfer: transfer, params: params)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end
    end

    describe '#save_transfer' do
      it 'saves transfer successfully' do
        transfer.assign_attributes(description: "New description")

        result = operation.send(:save_transfer, transfer: transfer)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
        expect(transfer.reload.description).to eq("New description")
      end

      it 'handles save errors' do
        allow(transfer).to receive(:save!).and_raise(StandardError.new("Save error"))
        allow(transfer).to receive(:errors).and_return(instance_double(ActiveModel::Errors, to_hash: { description: ["is too long"] }))

        result = operation.send(:save_transfer, transfer: transfer)
        expect(result).to be_failure
        expect(result.failure).to include(:description)
      end
    end

    describe '#attach_file' do
      let(:file) { fixture_file_upload('test.txt', 'text/plain') }

      it 'attaches file when provided' do
        allow(Utils::ActiveStorage).to receive(:attach_file).and_return(true)

        result = operation.send(:attach_file, transfer: transfer, params: { file: file, space_id: space.id.to_s })
        expect(result).to be_success

        expect(Utils::ActiveStorage).to have_received(:attach_file).with(
          transfer.files,
          file,
          space.id.to_s
        )
      end

      it 'returns transfer when file is blank' do
        result = operation.send(:attach_file, transfer: transfer, params: { file: nil, space_id: space.id.to_s })
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end

      it 'destroys existing files before attaching new one' do
        allow(transfer.files).to receive(:destroy_all)
        allow(Utils::ActiveStorage).to receive(:attach_file).and_return(true)

        result = operation.send(:attach_file, transfer: transfer, params: { file: file, space_id: space.id.to_s })
        expect(result).to be_success

        expect(transfer.files).to have_received(:destroy_all)
      end
    end

    describe '#update_monthly_summary' do
      it 'calls MonthlyFinancialSummaries::Operations::UpdateSummary with correct parameters' do
        update_summary_operation = instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary)
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Success())

        result = operation.send(:update_monthly_summary, transfer: transfer)
        expect(result).to be_success

        expect(update_summary_operation).to have_received(:call).with(
          space_id: transfer.space_id,
          transaction_date: transfer.date.to_date
        )
      end

      it 'returns success even when UpdateSummary fails' do
        update_summary_operation = instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary)
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Failure(error: "Summary update failed"))

        result = operation.send(:update_monthly_summary, transfer: transfer)
        expect(result).to be_success
      end
    end
  end
end
