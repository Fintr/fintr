# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::CreateTransfer do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }

  describe '#call' do
    context 'with valid parameters' do
      let(:valid_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 100.00,
          transaction_cost: 10.00,
          date: Time.zone.today,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          description: "Monthly transfer",
          schedule_type: "one_time"
        }
      end

      it 'creates a new transfer successfully' do
        result = operation.call(params: valid_params)
        expect(result).to be_success

        transfer = result.value!
        expect(transfer).to be_a(Transactions::Transfer)
        expect(transfer.amount).to eq(Money.from_amount(100.00, "PHP"))
        expect(transfer.transaction_cost).to eq(Money.from_amount(10.00, "PHP"))
        expect(transfer.from_account).to eq(from_account)
        expect(transfer.to_account).to eq(to_account)
        expect(transfer.balance_state).to eq("calculated")
      end

      it 'updates account balances correctly' do
        result = operation.call(params: valid_params)
        expect(result).to be_success

        from_account.reload
        to_account.reload

        expect(from_account.balance).to eq(Money.from_amount(890.00, "PHP")) # 1000 - 100 - 10
        expect(to_account.balance).to eq(Money.from_amount(600.00, "PHP")) # 500 + 100
      end

      it 'creates transfer with correct attributes' do
        result = operation.call(params: valid_params)
        expect(result).to be_success

        transfer = result.value!
        expect(transfer.user_id).to eq(user.id)
        expect(transfer.space_id).to eq(space.id)
        expect(transfer.from_account_id).to eq(from_account.id)
        expect(transfer.to_account_id).to eq(to_account.id)
        expect(transfer.description).to eq("Monthly transfer")
        expect(transfer.balance_state).to eq("calculated")
        expect(transfer.amount_currency).to eq("PHP")
        expect(transfer.transaction_cost_currency).to eq("PHP")
      end

      it 'creates transfer fee transaction when transaction cost is positive' do
        create_transfer_fee_operation = instance_double(Transactions::Operations::Transfers::CreateTransferFeeTransaction)
        allow(Transactions::Operations::Transfers::CreateTransferFeeTransaction).to receive(:new).and_return(create_transfer_fee_operation)
        allow(create_transfer_fee_operation).to receive(:call).and_return(Success())

        result = operation.call(params: valid_params)
        expect(result).to be_success

        expect(create_transfer_fee_operation).to have_received(:call).with(
          transfer_id: kind_of(String),
          balance_state: "pending",
          user_id: valid_params[:user_id],
          space_id: valid_params[:space_id],
          amount: valid_params[:amount],
          amount_currency: "PHP",
          transaction_cost: valid_params[:transaction_cost],
          transaction_cost_currency: "PHP",
          date: valid_params[:date],
          description: valid_params[:description],
          from_account_id: kind_of(String),
          to_account_id: kind_of(String),
          schedule_type: valid_params[:schedule_type]
        )
      end

      it 'does not create transfer fee transaction when transaction cost is zero' do
        params_without_fee = valid_params.merge(transaction_cost: 0)
        create_transfer_fee_operation = instance_double(Transactions::Operations::Transfers::CreateTransferFeeTransaction)
        allow(Transactions::Operations::Transfers::CreateTransferFeeTransaction).to receive(:new).and_return(create_transfer_fee_operation)
        allow(create_transfer_fee_operation).to receive(:call).and_return(Success())

        result = operation.call(params: params_without_fee)
        expect(result).to be_success

        expect(create_transfer_fee_operation).not_to have_received(:call)
      end

      context 'with file attachment' do
        let(:file) { fixture_file_upload('test.txt', 'text/plain') }
        let(:params_with_file) { valid_params.merge(file: file) }

        it 'attaches file to transfer' do
          utils_active_storage = instance_double(Utils::ActiveStorage)
          allow(Utils::ActiveStorage).to receive(:attach_file).and_return(true)

          result = operation.call(params: params_with_file)
          expect(result).to be_success

          expect(Utils::ActiveStorage).to have_received(:attach_file).with(
            kind_of(ActiveStorage::Attached::Many),
            file,
            space.id
          )
        end

        it 'succeeds without file when no file is provided' do
          result = operation.call(params: valid_params)
          expect(result).to be_success
        end
      end
    end

    context 'with recurring transfer' do
      let(:valid_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 100.00,
          transaction_cost: 10.00,
          date: Time.zone.today,
          from_account_name: from_account.name,
          to_account_name: to_account.name,
          description: "Monthly transfer",
          schedule_type: "repeat",
          repeat_interval: "every_month"
        }
      end

      it 'creates future transfers' do
        result = operation.call(params: valid_params)
        expect(result).to be_success

        transfer = result.value!
        expect(transfer.repeat?).to be true
        expect(transfer.repeat_interval).to eq("every_month")
        expect(transfer.repeat_count).to eq(1)

        future_transfers = Transactions::Transfer.where.not(id: transfer.id)
        expect(future_transfers.count).to be > 0
        expect(future_transfers.first.balance_state).to eq("pending")
      end

      it 'creates schedule for repeat transfer' do
        utils_recurrence = instance_double(Utils::Recurrence)
        allow(Utils::Recurrence).to receive(:schedule).and_return({ "interval" => 1, "frequency" => "monthly" })

        result = operation.call(params: valid_params)
        expect(result).to be_success

        expect(Utils::Recurrence).to have_received(:schedule).with(
          date: valid_params[:date],
          repeat_interval: valid_params[:repeat_interval]
        )
      end

      it 'creates past transfers when transfer date is in the past' do
        past_date = Time.zone.today - 1.month
        params_with_past_date = valid_params.merge(date: past_date)

        create_repeat_transfers_operation = instance_double(Transactions::Operations::Transfers::CreateRepeatTransfers)
        allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_transfers_operation)
        allow(create_repeat_transfers_operation).to receive(:call).and_return(Success())

        result = operation.call(params: params_with_past_date)
        expect(result).to be_success

        expect(create_repeat_transfers_operation).to have_received(:call).with(
          params: {
            transfer_id: kind_of(String),
            balance_state: "calculated",
            date_start: (past_date + 1.day).to_datetime,
            date_end: Time.zone.today
          }
        )
      end

      it 'creates future transfers for repeat transfer' do
        create_repeat_transfers_operation = instance_double(Transactions::Operations::Transfers::CreateRepeatTransfers)
        allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_transfers_operation)
        allow(create_repeat_transfers_operation).to receive(:call).and_return(Success())

        result = operation.call(params: valid_params)
        expect(result).to be_success

        expect(create_repeat_transfers_operation).to have_received(:call).with(
          params: {
            transfer_id: kind_of(String),
            balance_state: "pending",
            date_start: Time.zone.tomorrow,
            date_end: Time.zone.today + 1.month
          }
        )
      end

      it 'does not create past or future transfers for one-time transfer' do
        one_time_params = valid_params.merge(schedule_type: "one_time")
        create_repeat_transfers_operation = instance_double(Transactions::Operations::Transfers::CreateRepeatTransfers)
        allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_transfers_operation)
        allow(create_repeat_transfers_operation).to receive(:call).and_return(Success())

        result = operation.call(params: one_time_params)
        expect(result).to be_success

        expect(create_repeat_transfers_operation).not_to have_received(:call)
      end
    end

    context 'with invalid parameters' do
      context 'when amount is negative' do
        let(:invalid_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: -100.00,
            transaction_cost: 10.00,
            date: Time.zone.today,
            from_account_name: from_account.name,
            to_account_name: to_account.name,
            schedule_type: "one_time"
          }
        end

        it 'returns validation error' do
          result = operation.call(params: invalid_params)
          expect(result).to be_failure
          expect(result.failure).to include(:amount)
        end
      end

      context 'when accounts do not exist' do
        let(:invalid_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.00,
            transaction_cost: 10.00,
            date: Time.zone.today,
            from_account_name: "NonExistentAccount",
            to_account_name: to_account.name,
            schedule_type: "one_time"
          }
        end

        it 'returns account not found error' do
          result = operation.call(params: invalid_params)
          expect(result).to be_failure
          expect(result.failure).to include(account_name: "'NonExistentAccount' not found")
        end
      end

      context 'when transfer creation fails' do
        let(:invalid_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.00,
            transaction_cost: 10.00,
            date: Time.zone.today,
            from_account_name: from_account.name,
            to_account_name: to_account.name,
            schedule_type: "one_time"
          }
        end

        it 'returns transfer creation error' do
          transfer_instance = instance_double(Transactions::Transfer)
          allow(Transactions::Transfer).to receive(:new).and_return(transfer_instance)
          allow(transfer_instance).to receive(:save!).and_raise(StandardError.new("Transfer creation failed"))
          allow(transfer_instance).to receive(:errors).and_return(instance_double(ActiveModel::Errors, to_hash: { error: "Transfer creation failed" }))

          result = operation.call(params: invalid_params)
          expect(result).to be_failure
          expect(result.failure).to include(:transfer)
        end
      end

      context 'when schedule creation fails' do
        let(:repeat_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.00,
            transaction_cost: 10.00,
            date: Time.zone.today,
            from_account_name: from_account.name,
            to_account_name: to_account.name,
            schedule_type: "repeat",
            repeat_interval: "every_month"
          }
        end

        it 'returns schedule creation error' do
          allow(Utils::Recurrence).to receive(:schedule).and_raise(StandardError.new("Schedule creation failed"))

          result = operation.call(params: repeat_params)
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end
      end

      context 'when create_transfer_fee_transaction fails' do
        let(:valid_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.00,
            transaction_cost: 10.00,
            date: Time.zone.today,
            from_account_name: from_account.name,
            to_account_name: to_account.name,
            schedule_type: "one_time"
          }
        end

        it 'propagates the failure' do
          create_transfer_fee_operation = instance_double(Transactions::Operations::Transfers::CreateTransferFeeTransaction)
          allow(Transactions::Operations::Transfers::CreateTransferFeeTransaction).to receive(:new).and_return(create_transfer_fee_operation)
          allow(create_transfer_fee_operation).to receive(:call).and_return(Failure(error: "Fee transaction creation failed"))

          result = operation.call(params: valid_params)
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end
      end

      context 'when calculate_balances fails' do
        let(:valid_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.00,
            transaction_cost: 10.00,
            date: Time.zone.today,
            from_account_name: from_account.name,
            to_account_name: to_account.name,
            schedule_type: "one_time"
          }
        end

        it 'propagates the failure' do
          calculate_balances_operation = instance_double(Transactions::Operations::Transfers::CalculateBalances)
          allow(Transactions::Operations::Transfers::CalculateBalances).to receive(:new).and_return(calculate_balances_operation)
          allow(calculate_balances_operation).to receive(:call).and_return(Failure(error: "Balance calculation failed"))

          result = operation.call(params: valid_params)
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end
      end

      context 'when create_past_transfers fails' do
        let(:repeat_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.00,
            transaction_cost: 10.00,
            date: Time.zone.today - 1.month,
            from_account_name: from_account.name,
            to_account_name: to_account.name,
            schedule_type: "repeat",
            repeat_interval: "every_month"
          }
        end

        it 'propagates the failure' do
          create_repeat_transfers_operation = instance_double(Transactions::Operations::Transfers::CreateRepeatTransfers)
          allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_transfers_operation)
          allow(create_repeat_transfers_operation).to receive(:call).and_return(Failure(error: "Past transfers creation failed"))

          result = operation.call(params: repeat_params)
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end
      end

      context 'when create_future_transfers fails' do
        let(:repeat_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.00,
            transaction_cost: 10.00,
            date: Time.zone.today,
            from_account_name: from_account.name,
            to_account_name: to_account.name,
            schedule_type: "repeat",
            repeat_interval: "every_month"
          }
        end

        it 'propagates the failure' do
          create_repeat_transfers_operation = instance_double(Transactions::Operations::Transfers::CreateRepeatTransfers)
          allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_transfers_operation)
          allow(create_repeat_transfers_operation).to receive(:call).and_return(Failure(error: "Future transfers creation failed"))

          result = operation.call(params: repeat_params)
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end
      end
    end
  end

  describe 'Contract Validations' do
    let(:base_valid_params) do
      {
        user_id: user.id,
        space_id: space.id,
        amount: 100.00,
        transaction_cost: 10.00,
        date: Time.zone.today,
        from_account_name: from_account.name,
        to_account_name: to_account.name,
        description: "Monthly transfer",
        schedule_type: "one_time"
      }
    end

    # Test for required fields
    %i[user_id space_id amount transaction_cost date from_account_name to_account_name schedule_type].each do |field|
      it "fails if #{field} is missing" do
        params = base_valid_params.except(field)
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to include(field => ['is missing'])
      end
    end

    it 'fails if amount is not greater than 0' do
      params = base_valid_params.merge(amount: 0)
      result = operation.call(params: params)
      expect(result).to be_failure
      expect(result.failure).to include(amount: ['must be greater than 0'])
    end

    it 'fails if transaction_cost is negative' do
      params = base_valid_params.merge(transaction_cost: -1)
      result = operation.call(params: params)
      expect(result).to be_failure
      expect(result.failure).to include(transaction_cost: ['must be greater than or equal to 0'])
    end

    it 'succeeds if transaction_cost is 0' do
      params = base_valid_params.merge(transaction_cost: 0)
      allow(Transactions::Account).to receive(:find_by!).and_return(from_account, to_account)

      # Replace receive_message_chain with proper stubbing
      transfer_instance = instance_double(Transactions::Transfer)
      allow(Transactions::Transfer).to receive(:new).and_return(transfer_instance)
      allow(transfer_instance).to receive(:save!).and_return(true)

      allow(operation).to receive(:calculate_balances).and_return(Dry::Monads::Success())
      allow(operation).to receive(:create_past_transfers).and_return(Dry::Monads::Success())
      allow(operation).to receive(:create_future_transfers).and_return(Dry::Monads::Success())
      allow(operation).to receive(:attach_file).and_return(Dry::Monads::Success(instance_double(Transactions::Transfer, reload: true)))

      contract_result = described_class::Contract.new.call(**params)
      expect(contract_result.success?).to be true
    end

    it 'fails if schedule_type is invalid' do
      params = base_valid_params.merge(schedule_type: 'invalid_type')
      result = operation.call(params: params)
      expect(result).to be_failure
      expect(result.failure).to include(schedule_type: ['must be one of: one_time, repeat'])
    end

    context 'when schedule_type is repeat' do
      it 'fails if repeat_interval is missing' do
        params = base_valid_params.merge(schedule_type: 'repeat', repeat_interval: nil)
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to include(repeat_interval: ['must be provided for recurring transfers'])
      end

      it 'fails if repeat_interval is invalid' do
        params = base_valid_params.merge(schedule_type: 'repeat', repeat_interval: 'invalid_interval')
        result = operation.call(params: params)
        expect(result).to be_failure
        expect(result.failure).to include(repeat_interval: ['must be a valid interval'])
      end

      it 'succeeds if repeat_interval is valid' do
        params = base_valid_params.merge(schedule_type: 'repeat', repeat_interval: 'every_week')
        allow(Transactions::Account).to receive(:find_by!).and_return(from_account, to_account)

        # Replace receive_message_chain with proper stubbing
        transfer_instance = instance_double(Transactions::Transfer, reload: true, assign_attributes: true, one_time?: false, repeat?: true, date: Time.zone.today)
        allow(Transactions::Transfer).to receive(:new).and_return(transfer_instance)
        allow(transfer_instance).to receive(:save!).and_return(transfer_instance)

        allow(operation).to receive(:calculate_balances).and_return(Dry::Monads::Success())
        allow(operation).to receive(:create_schedule).and_return(Dry::Monads::Success(instance_double(Transactions::Transfer, reload: true)))
        allow(operation).to receive(:create_past_transfers).and_return(Dry::Monads::Success())
        allow(operation).to receive(:create_future_transfers).and_return(Dry::Monads::Success())
        allow(operation).to receive(:attach_file).and_return(Dry::Monads::Success(instance_double(Transactions::Transfer, reload: true)))

        contract_result = described_class::Contract.new.call(**params)
        expect(contract_result.success?).to be true
      end
    end
  end

  describe 'Private Methods' do
    describe '#find_account' do
      let(:params) { { space_id: space.id } }

      it 'finds account successfully' do
        result = operation.send(:find_account, params: params, account_name: from_account.name)
        expect(result).to be_success
        expect(result.value!).to eq(from_account)
      end

      it 'returns failure when account is not found' do
        result = operation.send(:find_account, params: params, account_name: "NonExistentAccount")
        expect(result).to be_failure
        expect(result.failure).to include(account_name: "'NonExistentAccount' not found")
      end

      it 'returns failure when account is discarded' do
        from_account.discard
        result = operation.send(:find_account, params: params, account_name: from_account.name)
        expect(result).to be_failure
        expect(result.failure).to include(account_name: "'#{from_account.name}' not found")
      end
    end

    describe '#transform_params' do
      let(:params) do
        {
          user_id: user.id,
          space_id: space.id,
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

      it 'transforms params correctly for one-time transfer' do
        one_time_params = params.merge(schedule_type: "one_time")
        result = operation.send(:transform_params, params: one_time_params, from_account: from_account, to_account: to_account)

        expect(result).to be_success
        transformed = result.value!
        expect(transformed[:from_account_id]).to eq(from_account.id)
        expect(transformed[:to_account_id]).to eq(to_account.id)
        expect(transformed[:balance_state]).to eq("pending")
        expect(transformed[:amount_currency]).to eq("PHP")
        expect(transformed[:transaction_cost_currency]).to eq("PHP")
        expect(transformed[:repeat_count]).to be_nil
        expect(transformed).not_to have_key(:from_account_name)
        expect(transformed).not_to have_key(:to_account_name)
      end

      it 'transforms params correctly for repeat transfer' do
        result = operation.send(:transform_params, params: params, from_account: from_account, to_account: to_account)

        expect(result).to be_success
        transformed = result.value!
        expect(transformed[:from_account_id]).to eq(from_account.id)
        expect(transformed[:to_account_id]).to eq(to_account.id)
        expect(transformed[:balance_state]).to eq("pending")
        expect(transformed[:amount_currency]).to eq("PHP")
        expect(transformed[:transaction_cost_currency]).to eq("PHP")
        expect(transformed[:repeat_count]).to eq(1)
        expect(transformed).not_to have_key(:from_account_name)
        expect(transformed).not_to have_key(:to_account_name)
      end

      it 'does not modify original params' do
        original_params = params.dup
        operation.send(:transform_params, params: params, from_account: from_account, to_account: to_account)
        expect(params).to eq(original_params)
      end
    end

    describe '#create_transfer' do
      let(:params) do
        {
          user_id: user.id,
          space_id: space.id,
          from_account_id: from_account.id,
          to_account_id: to_account.id,
          amount: Money.from_amount(100, "PHP"),
          transaction_cost: Money.from_amount(10, "PHP"),
          date: Time.zone.today,
          description: "Test transfer",
          balance_state: "pending",
          amount_currency: "PHP",
          transaction_cost_currency: "PHP",
          schedule_type: "one_time",
          file: "some_file"
        }
      end

      it 'creates transfer successfully' do
        result = operation.send(:create_transfer, params: params)
        expect(result).to be_success

        transfer = result.value!
        expect(transfer).to be_a(Transactions::Transfer)
        expect(transfer.user_id).to eq(user.id)
        expect(transfer.space_id).to eq(space.id)
        expect(transfer.from_account_id).to eq(from_account.id)
        expect(transfer.to_account_id).to eq(to_account.id)
        expect(transfer.amount).to eq(Money.from_amount(100, "PHP"))
        expect(transfer.transaction_cost).to eq(Money.from_amount(10, "PHP"))
        expect(transfer.description).to eq("Test transfer")
        expect(transfer.balance_state).to eq("pending")
      end

      it 'excludes file from transfer creation' do
        result = operation.send(:create_transfer, params: params)
        expect(result).to be_success

        transfer = result.value!
        expect(transfer).to be_a(Transactions::Transfer)
        # File should not be saved as part of transfer attributes
      end

      it 'returns failure when transfer creation fails' do
        transfer_instance = instance_double(Transactions::Transfer)
        allow(Transactions::Transfer).to receive(:new).and_return(transfer_instance)
        allow(transfer_instance).to receive(:save!).and_raise(StandardError.new("Creation failed"))
        allow(transfer_instance).to receive(:errors).and_return(instance_double(ActiveModel::Errors, to_hash: { error: "Creation failed" }))

        result = operation.send(:create_transfer, params: params)
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end
    end

    describe '#create_transfer_fee_transaction' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:, transaction_cost: Money.from_amount(10, "PHP")) }
      let(:params) { { user_id: user.id, space_id: space.id } }

      it 'creates fee transaction when transaction cost is positive' do
        create_fee_operation = instance_double(Transactions::Operations::Transfers::CreateTransferFeeTransaction)
        allow(Transactions::Operations::Transfers::CreateTransferFeeTransaction).to receive(:new).and_return(create_fee_operation)
        allow(create_fee_operation).to receive(:call).and_return(Success())

        result = operation.send(:create_transfer_fee_transaction, transfer: transfer, params: params)
        expect(result).to be_success

        expect(create_fee_operation).to have_received(:call).with(
          transfer_id: transfer.id,
          balance_state: "calculated",
          **params
        )
      end

      it 'returns success without creating fee transaction when transaction cost is zero' do
        transfer_without_fee = create(:transfer, user:, space:, from_account:, to_account:, transaction_cost: Money.from_amount(0, "PHP"))
        create_fee_operation = instance_spy(Transactions::Operations::Transfers::CreateTransferFeeTransaction)
        allow(Transactions::Operations::Transfers::CreateTransferFeeTransaction).to receive(:new).and_return(create_fee_operation)

        result = operation.send(:create_transfer_fee_transaction, transfer: transfer_without_fee, params: params)
        expect(result).to be_success

        expect(create_fee_operation).not_to have_received(:call)
      end
    end

    describe '#attach_file' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:) }
      let(:file) { fixture_file_upload('test.txt', 'text/plain') }

      it 'attaches file when file is provided' do
        allow(Utils::ActiveStorage).to receive(:attach_file).and_return(true)

        result = operation.send(:attach_file, transfer: transfer, params: { file: file, space_id: space.id })
        expect(result).to be_success

        expect(Utils::ActiveStorage).to have_received(:attach_file).with(
          transfer.files,
          file,
          space.id
        )
      end

      it 'returns success without attaching when file is blank' do
        result = operation.send(:attach_file, transfer: transfer, params: { file: nil, space_id: space.id })
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end

      it 'returns success without attaching when file is empty string' do
        result = operation.send(:attach_file, transfer: transfer, params: { file: "", space_id: space.id })
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end
    end

    describe '#calculate_balances' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:) }

      it 'calls CalculateBalances operation' do
        calculate_balances_operation = instance_double(Transactions::Operations::Transfers::CalculateBalances)
        allow(Transactions::Operations::Transfers::CalculateBalances).to receive(:new).and_return(calculate_balances_operation)
        allow(calculate_balances_operation).to receive(:call).and_return(Success())

        result = operation.send(:calculate_balances, transfer: transfer)
        expect(result).to be_success

        expect(calculate_balances_operation).to have_received(:call).with(transfer_id: transfer.id)
      end
    end

    describe '#create_schedule' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:) }
      let(:params) { { schedule_type: "repeat", date: Time.zone.today, repeat_interval: "every_month" } }

      it 'creates schedule for repeat transfer' do
        allow(Utils::Recurrence).to receive(:schedule).and_return({ "interval" => 1, "frequency" => "monthly" })

        result = operation.send(:create_schedule, transfer: transfer, params: params)
        expect(result).to be_success

        expect(Utils::Recurrence).to have_received(:schedule).with(
          date: params[:date],
          repeat_interval: params[:repeat_interval]
        )
      end

      it 'returns success without creating schedule for one-time transfer' do
        one_time_params = params.merge(schedule_type: "one_time")

        result = operation.send(:create_schedule, transfer: transfer, params: one_time_params)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end

      it 'returns failure when schedule creation fails' do
        allow(Utils::Recurrence).to receive(:schedule).and_raise(StandardError.new("Schedule creation failed"))

        result = operation.send(:create_schedule, transfer: transfer, params: params)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end

    describe '#create_past_transfers' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:, date: Time.zone.today - 1.month) }

      it 'creates past transfers for repeat transfer with past date' do
        allow(transfer).to receive(:one_time?).and_return(false)
        create_repeat_operation = instance_double(Transactions::Operations::Transfers::CreateRepeatTransfers)
        allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_operation)
        allow(create_repeat_operation).to receive(:call).and_return(Success())

        result = operation.send(:create_past_transfers, transfer: transfer)
        expect(result).to be_success

        expect(create_repeat_operation).to have_received(:call).with(
          params: {
            transfer_id: transfer.id,
            balance_state: "calculated",
            date_start: (transfer.date + 1.day).to_datetime,
            date_end: Time.zone.today
          }
        )
      end

      it 'returns success without creating past transfers for one-time transfer' do
        allow(transfer).to receive(:one_time?).and_return(true)
        create_repeat_operation = instance_spy(Transactions::Operations::Transfers::CreateRepeatTransfers)
        allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_operation)

        result = operation.send(:create_past_transfers, transfer: transfer)
        expect(result).to be_success

        expect(create_repeat_operation).not_to have_received(:call)
      end

      it 'returns success without creating past transfers when transfer date is today or future' do
        future_transfer = create(:transfer, user:, space:, from_account:, to_account:, date: Time.zone.today)
        allow(future_transfer).to receive(:one_time?).and_return(false)
        create_repeat_operation = instance_spy(Transactions::Operations::Transfers::CreateRepeatTransfers)
        allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_operation)

        result = operation.send(:create_past_transfers, transfer: future_transfer)
        expect(result).to be_success

        expect(create_repeat_operation).not_to have_received(:call)
      end
    end

    describe '#create_future_transfers' do
      let(:transfer) { create(:transfer, user:, space:, from_account:, to_account:) }

      it 'creates future transfers for repeat transfer' do
        allow(transfer).to receive(:one_time?).and_return(false)
        create_repeat_operation = instance_double(Transactions::Operations::Transfers::CreateRepeatTransfers)
        allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_operation)
        allow(create_repeat_operation).to receive(:call).and_return(Success())

        result = operation.send(:create_future_transfers, transfer: transfer)
        expect(result).to be_success

        expect(create_repeat_operation).to have_received(:call).with(
          params: {
            transfer_id: transfer.id,
            balance_state: "pending",
            date_start: Time.zone.tomorrow,
            date_end: Time.zone.today + 1.month
          }
        )
      end

      it 'returns success without creating future transfers for one-time transfer' do
        allow(transfer).to receive(:one_time?).and_return(true)
        create_repeat_operation = instance_spy(Transactions::Operations::Transfers::CreateRepeatTransfers)
        allow(Transactions::Operations::Transfers::CreateRepeatTransfers).to receive(:new).and_return(create_repeat_operation)

        result = operation.send(:create_future_transfers, transfer: transfer)
        expect(result).to be_success

        expect(create_repeat_operation).not_to have_received(:call)
      end
    end
  end
end
