# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::UpdateRepeatTransfers do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:transfer) do
    create(:transfer, :repeat,
           user:,
           space:,
           from_account:,
           to_account:,
           amount: Money.from_amount(100, "PHP"),
           transaction_cost: Money.from_amount(10, "PHP"),
           date: Time.zone.today).tap do |t|
      t.description = "Updated description" # Make it changed
    end
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when transfer is missing' do
        result = operation.validate(params: {
          update_scope: "this_and_future"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end

      it 'fails when update_scope is missing' do
        result = operation.validate(params: {
          transfer: transfer
        })
        expect(result).to be_failure
        expect(result.failure).to include(:update_scope)
      end
    end

    context 'with invalid update_scope' do
      it 'fails when update_scope is not a valid option' do
        result = operation.validate(params: {
          transfer: transfer,
          update_scope: "invalid_scope"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:update_scope)
      end

      it 'fails when update_scope is "this_only"' do
        result = operation.validate(params: {
          transfer: transfer,
          update_scope: "this_only"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:update_scope)
      end
    end

    context 'with invalid transfer' do
      it 'fails when transfer is not a Transfer instance' do
        # This will fail at the type check before reaching changed? check
        expect {
          operation.validate(params: {
            transfer: "not_a_transfer",
            update_scope: "this_and_future"
          })
        }.to raise_error(NoMethodError)
      end

      it 'fails when transfer has no changes' do
        unchanged_transfer = create(:transfer, :repeat, user:, space:, from_account:, to_account:)
        result = operation.validate(params: {
          transfer: unchanged_transfer,
          update_scope: "this_and_future"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation with "this_and_future" scope' do
        result = operation.validate(params: {
          transfer: transfer,
          update_scope: "this_and_future"
        })
        expect(result).to be_success
      end

      it 'succeeds validation with "all_in_series" scope' do
        result = operation.validate(params: {
          transfer: transfer,
          update_scope: "all_in_series"
        })
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    let(:valid_params) do
      {
        transfer: transfer,
        update_scope: "this_and_future"
      }
    end

    context 'with invalid parameters' do
      it 'returns validation error for missing transfer' do
        result = operation.call({
          update_scope: "this_and_future"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end

      it 'returns validation error for invalid update_scope' do
        result = operation.call({
          transfer: transfer,
          update_scope: "invalid_scope"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:update_scope)
      end

      it 'returns validation error for unchanged transfer' do
        unchanged_transfer = create(:transfer, :repeat, user:, space:, from_account:, to_account:)
        result = operation.call({
          transfer: unchanged_transfer,
          update_scope: "this_and_future"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transfer)
      end
    end

    context 'with valid parameters' do
      let(:update_this_and_future_operation) { instance_double(Transactions::Operations::Transfers::UpdateThisAndFutureTransfers) }
      let(:update_all_in_series_operation) { instance_double(Transactions::Operations::Transfers::UpdateAllInSeriesTransfers) }
      let(:delete_this_and_future_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisAndFutureTransfers) }
      let(:delete_all_in_series_operation) { instance_double(Transactions::Operations::Transfers::DeleteAllInSeriesTransfers) }

      before do
        allow(Transactions::Operations::Transfers::UpdateThisAndFutureTransfers).to receive(:new).and_return(update_this_and_future_operation)
        allow(Transactions::Operations::Transfers::UpdateAllInSeriesTransfers).to receive(:new).and_return(update_all_in_series_operation)
        allow(Transactions::Operations::Transfers::DeleteThisAndFutureTransfers).to receive(:new).and_return(delete_this_and_future_operation)
        allow(Transactions::Operations::Transfers::DeleteAllInSeriesTransfers).to receive(:new).and_return(delete_all_in_series_operation)
      end

      context 'with update_scope: "this_and_future"' do
        let(:params_this_and_future) { valid_params.merge(update_scope: "this_and_future") }

        context 'when transfer changes from repeat to one_time' do
          let(:transfer_changing_to_one_time) do
            create(:transfer, :repeat, user:, space:, from_account:, to_account:).tap do |t|
              t.schedule_type = "one_time"
            end
          end

          it 'calls DeleteThisAndFutureTransfers with except_this_transfer: true' do
            expect(delete_this_and_future_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock
              hash_including(except_this_transfer: true, transfer: transfer_changing_to_one_time, update_scope: "this_and_future")
            ).and_return(Success(transfer_changing_to_one_time))

            result = operation.call({
              transfer: transfer_changing_to_one_time,
              update_scope: "this_and_future"
            })
            expect(result).to be_success
            expect(result.value!).to eq(transfer_changing_to_one_time)
          end
        end

        context 'when transfer does not change from repeat to one_time' do
          it 'calls UpdateThisAndFutureTransfers' do
            expect(update_this_and_future_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock
              hash_including(transfer:, update_scope: "this_and_future")
            ).and_return(Success(transfer))

            result = operation.call(params_this_and_future)
            expect(result).to be_success
            expect(result.value!).to eq(transfer)
          end
        end
      end

      context 'with update_scope: "all_in_series"' do
        let(:params_all_in_series) { valid_params.merge(update_scope: "all_in_series") }

        context 'when transfer changes from repeat to one_time' do
          let(:transfer_changing_to_one_time) do
            create(:transfer, :repeat, user:, space:, from_account:, to_account:).tap do |t|
              t.schedule_type = "one_time"
            end
          end

          it 'calls DeleteAllInSeriesTransfers with except_this_transfer: true' do
            expect(delete_all_in_series_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock
              hash_including(except_this_transfer: true, transfer: transfer_changing_to_one_time, update_scope: "all_in_series")
            ).and_return(Success(transfer_changing_to_one_time))

            result = operation.call({
              transfer: transfer_changing_to_one_time,
              update_scope: "all_in_series"
            })
            expect(result).to be_success
            expect(result.value!).to eq(transfer_changing_to_one_time)
          end
        end

        context 'when transfer does not change from repeat to one_time' do
          it 'calls UpdateAllInSeriesTransfers' do
            expect(update_all_in_series_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock
              hash_including(transfer:, update_scope: "all_in_series")
            ).and_return(Success(transfer))

            result = operation.call(params_all_in_series)
            expect(result).to be_success
            expect(result.value!).to eq(transfer)
          end
        end
      end

      context 'when sub-operation fails' do
        it 'propagates failure from UpdateThisAndFutureTransfers' do
          expect(update_this_and_future_operation).to receive(:call).and_return(Failure(error: "update failed")) # rubocop:disable RSpec/StubbedMock

          result = operation.call({
            transfer: transfer,
            update_scope: "this_and_future"
          })
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end

        it 'propagates failure from UpdateAllInSeriesTransfers' do
          expect(update_all_in_series_operation).to receive(:call).and_return(Failure(error: "update failed")) # rubocop:disable RSpec/StubbedMock

          result = operation.call({
            transfer: transfer,
            update_scope: "all_in_series"
          })
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end

        it 'propagates failure from DeleteThisAndFutureTransfers' do
          transfer_changing_to_one_time = create(:transfer, :repeat, user:, space:, from_account:, to_account:).tap { |t| t.schedule_type = "one_time" }
          expect(delete_this_and_future_operation).to receive(:call).and_return(Failure(error: "delete failed")) # rubocop:disable RSpec/StubbedMock

          result = operation.call({
            transfer: transfer_changing_to_one_time,
            update_scope: "this_and_future"
          })
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end

        it 'propagates failure from DeleteAllInSeriesTransfers' do
          transfer_changing_to_one_time = create(:transfer, :repeat, user:, space:, from_account:, to_account:).tap { |t| t.schedule_type = "one_time" }
          expect(delete_all_in_series_operation).to receive(:call).and_return(Failure(error: "delete failed")) # rubocop:disable RSpec/StubbedMock

          result = operation.call({
            transfer: transfer_changing_to_one_time,
            update_scope: "all_in_series"
          })
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end
      end
    end
  end

  describe '#update_transfers' do
    let(:update_this_and_future_operation) { instance_double(Transactions::Operations::Transfers::UpdateThisAndFutureTransfers) }
    let(:update_all_in_series_operation) { instance_double(Transactions::Operations::Transfers::UpdateAllInSeriesTransfers) }

    before do
      allow(Transactions::Operations::Transfers::UpdateThisAndFutureTransfers).to receive(:new).and_return(update_this_and_future_operation)
      allow(Transactions::Operations::Transfers::UpdateAllInSeriesTransfers).to receive(:new).and_return(update_all_in_series_operation)
    end

    context 'with update_scope: "this_and_future"' do
      it 'calls update_this_and_future_transfers' do
        expect(update_this_and_future_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock
          hash_including(transfer:, update_scope: "this_and_future")
        ).and_return(Success(transfer))

        result = operation.send(:update_transfers, params: {
          transfer: transfer,
          update_scope: "this_and_future"
        })
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end
    end

    context 'with update_scope: "all_in_series"' do
      it 'calls update_all_in_series_transfers' do
        expect(update_all_in_series_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock
          hash_including(transfer:, update_scope: "all_in_series")
        ).and_return(Success(transfer))

        result = operation.send(:update_transfers, params: {
          transfer: transfer,
          update_scope: "all_in_series"
        })
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end
    end

    context 'with invalid update_scope' do
      it 'returns failure for invalid scope' do
        result = operation.send(:update_transfers, params: {
          transfer: transfer,
          update_scope: "invalid_scope"
        })
        expect(result).to be_success
        expect(result.value!).to be_failure
        expect(result.value!.failure).to include(:update_scope)
      end
    end
  end

  describe '#update_this_and_future_transfers' do
    let(:update_this_and_future_operation) { instance_double(Transactions::Operations::Transfers::UpdateThisAndFutureTransfers) }
    let(:delete_this_and_future_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisAndFutureTransfers) }

    before do
      allow(Transactions::Operations::Transfers::UpdateThisAndFutureTransfers).to receive(:new).and_return(update_this_and_future_operation)
      allow(Transactions::Operations::Transfers::DeleteThisAndFutureTransfers).to receive(:new).and_return(delete_this_and_future_operation)
    end

    context 'when transfer changes from repeat to one_time' do
      let(:transfer_changing_to_one_time) do
        create(:transfer, :repeat, user:, space:, from_account:, to_account:).tap do |t|
          t.schedule_type = "one_time"
        end
      end

      it 'calls DeleteThisAndFutureTransfers with except_this_transfer: true' do
        expect(delete_this_and_future_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock
          hash_including(except_this_transfer: true, transfer: transfer_changing_to_one_time, update_scope: "this_and_future")
        ).and_return(Success(transfer_changing_to_one_time))

        result = operation.send(:update_this_and_future_transfers, params: {
          transfer: transfer_changing_to_one_time,
          update_scope: "this_and_future"
        })
        expect(result).to be_success
        expect(result.value!).to eq(transfer_changing_to_one_time)
      end
    end

    context 'when transfer does not change from repeat to one_time' do
      it 'calls UpdateThisAndFutureTransfers' do
        expect(update_this_and_future_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock
          hash_including(transfer:, update_scope: "this_and_future")
        ).and_return(Success(transfer))

        result = operation.send(:update_this_and_future_transfers, params: {
          transfer: transfer,
          update_scope: "this_and_future"
        })
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end
    end

    context 'when transfer changes from one_time to repeat' do
      let(:transfer_changing_to_repeat) do
        create(:transfer, user:, space:, from_account:, to_account:, schedule_type: "one_time").tap do |t|
          t.schedule_type = "repeat"
        end
      end

      it 'calls UpdateThisAndFutureTransfers' do
        expect(update_this_and_future_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock
          hash_including(transfer: transfer_changing_to_repeat, update_scope: "this_and_future")
        ).and_return(Success(transfer_changing_to_repeat))

        result = operation.send(:update_this_and_future_transfers, params: {
          transfer: transfer_changing_to_repeat,
          update_scope: "this_and_future"
        })
        expect(result).to be_success
        expect(result.value!).to eq(transfer_changing_to_repeat)
      end
    end
  end

  describe '#update_all_in_series_transfers' do
    let(:update_all_in_series_operation) { instance_double(Transactions::Operations::Transfers::UpdateAllInSeriesTransfers) }
    let(:delete_all_in_series_operation) { instance_double(Transactions::Operations::Transfers::DeleteAllInSeriesTransfers) }

    before do
      allow(Transactions::Operations::Transfers::UpdateAllInSeriesTransfers).to receive(:new).and_return(update_all_in_series_operation)
      allow(Transactions::Operations::Transfers::DeleteAllInSeriesTransfers).to receive(:new).and_return(delete_all_in_series_operation)
    end

    context 'when transfer changes from repeat to one_time' do
      let(:transfer_changing_to_one_time) do
        create(:transfer, :repeat, user:, space:, from_account:, to_account:).tap do |t|
          t.schedule_type = "one_time"
        end
      end

      it 'calls DeleteAllInSeriesTransfers with except_this_transfer: true' do
        expect(delete_all_in_series_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock
          hash_including(except_this_transfer: true, transfer: transfer_changing_to_one_time, update_scope: "all_in_series")
        ).and_return(Success(transfer_changing_to_one_time))

        result = operation.send(:update_all_in_series_transfers, params: {
          transfer: transfer_changing_to_one_time,
          update_scope: "all_in_series"
        })
        expect(result).to be_success
        expect(result.value!).to eq(transfer_changing_to_one_time)
      end
    end

    context 'when transfer does not change from repeat to one_time' do
      it 'calls UpdateAllInSeriesTransfers' do
        expect(update_all_in_series_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock
          hash_including(transfer:, update_scope: "all_in_series")
        ).and_return(Success(transfer))

        result = operation.send(:update_all_in_series_transfers, params: {
          transfer: transfer,
          update_scope: "all_in_series"
        })
        expect(result).to be_success
        expect(result.value!).to eq(transfer)
      end
    end

    context 'when transfer changes from one_time to repeat' do
      let(:transfer_changing_to_repeat) do
        create(:transfer, user:, space:, from_account:, to_account:, schedule_type: "one_time").tap do |t|
          t.schedule_type = "repeat"
        end
      end

      it 'calls UpdateAllInSeriesTransfers' do
        expect(update_all_in_series_operation).to receive(:call).with( # rubocop:disable RSpec/StubbedMock
          hash_including(transfer: transfer_changing_to_repeat, update_scope: "all_in_series")
        ).and_return(Success(transfer_changing_to_repeat))

        result = operation.send(:update_all_in_series_transfers, params: {
          transfer: transfer_changing_to_repeat,
          update_scope: "all_in_series"
        })
        expect(result).to be_success
        expect(result.value!).to eq(transfer_changing_to_repeat)
      end
    end
  end
end
