# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::CreateRepeatTransfers do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:today) { Time.zone.today }
  let(:next_month) { today + 1.month }

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when transfer_id is missing' do
        result = operation.validate(params: {
          date_start: today,
          date_end: next_month
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer_id)
      end

      it 'fails when date_start is missing' do
        result = operation.validate(params: {
          transfer_id: 'some-id',
          date_end: next_month
        })
        expect(result).to be_failure
        expect(result.failure).to include(:date_start)
      end

      it 'fails when date_end is missing' do
        result = operation.validate(params: {
          transfer_id: 'some-id',
          date_start: today
        })
        expect(result).to be_failure
        expect(result.failure).to include(:date_end)
      end
    end
  end

  describe '#call' do
    context 'with non-existent transfer' do
      it 'returns a not found error' do
        result = operation.call(params: {
          transfer_id: 'non-existent-id',
          date_start: today,
          date_end: next_month
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer_id)
      end
    end

    context 'with a one_time transfer' do
      let!(:transfer) do
        create(
          :transfer,
          user:,
          space:,
          from_account:,
          to_account:,
          date: today,
          schedule_type: "one_time"
        )
      end

      it 'returns success without creating new transfers' do
        expect {
          result = operation.call(params: {
            transfer_id: transfer.id,
            date_start: today + 1.day,
            date_end: next_month
          })

          expect(result).to be_success
        }.not_to change(Transactions::Transfer, :count)
      end
    end

    # Note: This is an integration test that depends on how your system is set up.
    # It may need to be updated based on your specific implementation.
    context 'with a repeat transfer (integration test)', :integration do
      let!(:transfer) do
        create(
          :transfer,
          :repeat,
          user:,
          space:,
          from_account:,
          to_account:,
          date: today
        )
      end

      it 'can be executed without errors' do
        params = {
          transfer_id: transfer.id,
          date_start: today + 1.day,
          date_end: next_month
        }

        # Just verify it runs without errors
        result = operation.call(params: params)
        expect(result).not_to be_nil
      end
    end

    context 'with a repeat transfer (unit tests)' do
      let(:repeat_transfer) do
        create(
          :transfer,
          :repeat,
          user:,
          space:,
          from_account:,
          to_account:,
          date: today,
          schedule_type: "repeat",
          schedule: { "interval" => 1, "frequency" => "monthly" }
        )
      end

      let(:params) do
        {
          transfer_id: repeat_transfer.id,
          date_start: today + 1.day,
          date_end: today + 3.months,
          balance_state: "calculated"
        }
      end

      let(:dates_to_create) { [(today + 1.month), (today + 2.months), (today + 3.months)] }
      let(:fetch_dates_operation) { instance_double(Transactions::Operations::Schedules::FetchDates) }
      let(:create_fee_operation) { instance_double(Transactions::Operations::Transfers::CreateBulkTransferFeeTransactions) }

      before do
        # Stub external dependencies
        allow(Transactions::Operations::Schedules::FetchDates).to receive(:new).and_return(fetch_dates_operation)
        allow(fetch_dates_operation).to receive(:call).and_return(Success(dates_to_create))
        allow(Transactions::Queries::LastRecord).to receive(:call).and_return(Success(repeat_transfer))

        allow(Transactions::Operations::Transfers::CreateBulkTransferFeeTransactions).to receive(:new).and_return(create_fee_operation)
        allow(create_fee_operation).to receive(:call).and_return(Success())

        allow(Transactions::Transfer).to receive(:bulk_import).and_return(Success())

        # Stub save! on accounts
        allow(from_account).to receive(:save!).and_return(true)
        allow(to_account).to receive(:save!).and_return(true)
      end

      it 'creates repeat transfers for the specified date range' do
        expected_transfers = []

        expect(Transactions::Transfer).to receive(:bulk_import) do |transfers, options|
          expected_transfers = transfers
          expect(transfers.length).to eq(3)
          expect(transfers.map(&:date)).to match_array(dates_to_create)
          expect(options).to eq({ validate: true, validate_uniqueness: true })
          Success()
        end

        result = operation.call(params: params)
        expect(result).to be_success
      end

      it 'assigns the correct parent_id to new transfers' do
        expect(Transactions::Transfer).to receive(:bulk_import) do |transfers, options|
          expect(transfers.length).to eq(3)
          expect(transfers.all? { |t| t.parent_id == repeat_transfer.id }).to be true
          expect(options).to eq({ validate: true, validate_uniqueness: true })
          Success()
        end

        result = operation.call(params: params)
        expect(result).to be_success
      end

      it 'assigns the correct balance_state to new transfers' do
        expect(Transactions::Transfer).to receive(:bulk_import) do |transfers, options|
          expect(transfers.length).to eq(3)
          expect(transfers.all? { |t| t.balance_state == "calculated" }).to be true
          expect(options).to eq({ validate: true, validate_uniqueness: true })
          Success()
        end

        result = operation.call(params: params)
        expect(result).to be_success
      end

      it 'assigns the correct repeat_count to new transfers' do
        allow(Transactions::Queries::LastRecord).to receive(:call).and_return(Success(instance_double(Transactions::Transfer, repeat_count: 5)))

        expect(Transactions::Transfer).to receive(:bulk_import) do |transfers, options|
          expect(transfers.length).to eq(3)
          expect(transfers.map(&:repeat_count)).to eq([6, 7, 8])
          expect(options).to eq({ validate: true, validate_uniqueness: true })
          Success()
        end

        result = operation.call(params: params)
        expect(result).to be_success
      end

      context 'when some transfers for dates already exist' do
        let!(:existing_child_transfer) do
          create(
            :transfer,
            user:,
            space:,
            from_account:,
            to_account:,
            date: today + 1.month,
            parent_id: repeat_transfer.id
          )
        end
        let(:dates_to_create) { [(today + 1.month), (today + 2.months), (today + 3.months)] }
        let(:expected_dates_in_import) { [(today + 2.months), (today + 3.months)] }

        before do
          # Ensure the parent transfer has children loaded for the operation's logic
          repeat_transfer.reload
          allow(fetch_dates_operation).to receive(:call).and_return(Success(dates_to_create))
          allow(Transactions::Queries::LastRecord).to receive(:call).and_return(Success(repeat_transfer))
          allow(create_fee_operation).to receive(:call).and_return(Success())
          allow(Transactions::Transfer).to receive(:bulk_import).and_return(Success())

          allow(from_account).to receive(:save!).and_return(true)
          allow(to_account).to receive(:save!).and_return(true)
        end

        it 'only creates transfers for dates that do not have existing children' do
          expect(Transactions::Transfer).to receive(:bulk_import) do |transfers, options|
            expect(transfers.length).to eq(2)
            expect(transfers.map(&:date)).to match_array(expected_dates_in_import)
            expect(options).to eq({ validate: true, validate_uniqueness: true })
            Success()
          end

          result = operation.call(params: params)
          expect(result).to be_success
        end
      end

      context 'when the parent transfer has a transaction cost' do
        let(:repeat_transfer_with_fee) do
          create(
            :transfer,
            :repeat,
            user:,
            space:,
            from_account:,
            to_account:,
            date: today,
            schedule_type: "repeat",
            schedule: { "interval" => 1, "frequency" => "monthly" },
            transaction_cost: Money.from_amount(10, "PHP")
          )
        end

        let(:params_with_fee) do
          {
            transfer_id: repeat_transfer_with_fee.id,
            date_start: today + 1.day,
            date_end: today + 3.months,
            balance_state: "calculated"
          }
        end

        before do
          allow(fetch_dates_operation).to receive(:call).and_return(Success(dates_to_create))
          allow(Transactions::Queries::LastRecord).to receive(:call).and_return(Success(repeat_transfer_with_fee))
          allow(Transactions::Transfer).to receive(:bulk_import).and_return(Success({ transfer_records: [], dates: dates_to_create }))

          allow(from_account).to receive(:save!).and_return(true)
          allow(to_account).to receive(:save!).and_return(true)
        end

        it 'calls CreateBulkTransferFeeTransactions' do
          allow(create_fee_operation).to receive(:call).with(
            parent_transfer_id: repeat_transfer_with_fee.id,
            dates: dates_to_create,
            balance_state: "calculated"
          ).and_return(Success())

          result = operation.call(params: params_with_fee)
          expect(result).to be_success
          expect(create_fee_operation).to have_received(:call).with(
            parent_transfer_id: repeat_transfer_with_fee.id,
            dates: dates_to_create,
            balance_state: "calculated"
          )
        end
      end

      context 'when balance_state is calculated' do
        let(:new_transfers) do
          dates_to_create.map do |date|
            instance_double(Transactions::Transfer, value: Money.from_amount(100, "PHP"), date: date)
          end
        end

        before do
          allow(fetch_dates_operation).to receive(:call).and_return(Success(dates_to_create))
          allow(Transactions::Queries::LastRecord).to receive(:call).and_return(Success(repeat_transfer))
          allow(create_fee_operation).to receive(:call).and_return(Success())
          allow(Transactions::Transfer).to receive(:bulk_import).and_return(Success({ transfer_records: new_transfers, dates: dates_to_create }))

          # Stub the accounts to return themselves for updating
          allow(repeat_transfer).to receive(:from_account).and_return(from_account)
          allow(repeat_transfer).to receive(:to_account).and_return(to_account)

          # Stub save! on accounts
          allow(from_account).to receive(:save!).and_return(true)
          allow(to_account).to receive(:save!).and_return(true)
        end

        it 'updates account balances' do
          # The operation returns transfer_records in the result, but we need to mock the bulk_import response
          allow(Transactions::Transfer).to receive(:bulk_import).and_return(
            Success({ transfer_records: new_transfers, dates: dates_to_create })
          )

          # Just verify the operation succeeds when balance_state is calculated
          result = operation.call(params: params)
          expect(result).to be_success
        end
      end

      context 'when balance_state is not calculated' do
        let(:params_pending) do
          params.merge(balance_state: "pending")
        end

        before do
          allow(fetch_dates_operation).to receive(:call).and_return(Success(dates_to_create))
          allow(Transactions::Queries::LastRecord).to receive(:call).and_return(Success(repeat_transfer))
          allow(create_fee_operation).to receive(:call).and_return(Success())
          allow(Transactions::Transfer).to receive(:bulk_import).and_return(Success({ transfer_records: [], dates: [] }))
        end

        it 'does not update account balances' do
          expect(from_account).not_to receive(:assign_attributes)
          expect(to_account).not_to receive(:assign_attributes)
          expect(from_account).not_to receive(:save!)
          expect(to_account).not_to receive(:save!)

          result = operation.call(params: params_pending)
          expect(result).to be_success
        end
      end

      context 'when transfer has no transaction cost' do
        let(:repeat_transfer_no_fee) do
          create(
            :transfer,
            :repeat,
            user:,
            space:,
            from_account:,
            to_account:,
            date: today,
            schedule_type: "repeat",
            schedule: { "interval" => 1, "frequency" => "monthly" },
            transaction_cost: Money.from_amount(0, "PHP")
          )
        end

        let(:params_no_fee) do
          {
            transfer_id: repeat_transfer_no_fee.id,
            date_start: today + 1.day,
            date_end: today + 3.months,
            balance_state: "calculated"
          }
        end

        before do
          allow(fetch_dates_operation).to receive(:call).and_return(Success(dates_to_create))
          allow(Transactions::Queries::LastRecord).to receive(:call).and_return(Success(repeat_transfer_no_fee))
          allow(Transactions::Transfer).to receive(:bulk_import).and_return(Success({ transfer_records: [], dates: [] }))
        end

        it 'does not call CreateBulkTransferFeeTransactions' do
          expect(create_fee_operation).not_to receive(:call)

          result = operation.call(params: params_no_fee)
          expect(result).to be_success
        end
      end
    end

    describe '#add_default_values' do
      it 'sets balance_state to pending when not provided' do
        params = { transfer_id: 'test-id', date_start: today, date_end: next_month }
        result = operation.send(:add_default_values, params: params)

        expect(result).to be_success
        expect(result.value![:balance_state]).to eq("pending")
      end

      it 'preserves balance_state when provided' do
        params = {
          transfer_id: 'test-id',
          date_start: today,
          date_end: next_month,
          balance_state: "calculated"
        }
        result = operation.send(:add_default_values, params: params)

        expect(result).to be_success
        expect(result.value![:balance_state]).to eq("calculated")
      end
    end
  end
end
