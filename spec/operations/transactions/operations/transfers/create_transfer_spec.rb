# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::CreateTransfer do
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
end
