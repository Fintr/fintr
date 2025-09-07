# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::DeleteTransfer do
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
           schedule_type: "one_time")
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when id is missing' do
        result = operation.validate(params: {
          space_id: space.id
        })
        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end

      it 'fails when space_id is missing' do
        result = operation.validate(params: {
          id: transfer.id
        })
        expect(result).to be_failure
        expect(result.failure).to include(:space_id)
      end
    end

    context 'with invalid delete_scope' do
      it 'fails when delete_scope is not a valid option' do
        result = operation.validate(params: {
          id: transfer.id,
          space_id: space.id,
          delete_scope: "invalid_scope"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:delete_scope)
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation with required parameters only' do
        result = operation.validate(params: {
          id: transfer.id,
          space_id: space.id
        })
        expect(result).to be_success
      end

      it 'succeeds validation with valid delete_scope' do
        result = operation.validate(params: {
          id: transfer.id,
          space_id: space.id,
          delete_scope: "this_only"
        })
        expect(result).to be_success
      end

      it 'succeeds validation with all valid delete_scopes' do
        %w[this_only this_and_future all_in_series].each do |scope|
          result = operation.validate(params: {
            id: transfer.id,
            space_id: space.id,
            delete_scope: scope
          })
          expect(result).to be_success
        end
      end
    end
  end

  describe '#call' do
    let(:valid_params) do
      {
        id: transfer.id,
        space_id: space.id
      }
    end

    context 'when transfer does not exist' do
      it 'returns not found error' do
        result = operation.call({
          id: "non-existent-id",
          space_id: space.id
        })
        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end

      it 'returns not found error when transfer exists but in different space' do
        other_space = create(:personal_space)
        result = operation.call({
          id: transfer.id,
          space_id: other_space.id
        })
        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end
    end

    context 'when transfer exists' do
      let(:delete_this_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisTransfer) }
      let(:delete_this_and_future_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisAndFutureTransfers) }
      let(:delete_all_in_series_operation) { instance_double(Transactions::Operations::Transfers::DeleteAllInSeriesTransfers) }

      before do
        allow(Transactions::Operations::Transfers::DeleteThisTransfer).to receive(:new).and_return(delete_this_operation)
        allow(Transactions::Operations::Transfers::DeleteThisAndFutureTransfers).to receive(:new).and_return(delete_this_and_future_operation)
        allow(Transactions::Operations::Transfers::DeleteAllInSeriesTransfers).to receive(:new).and_return(delete_all_in_series_operation)
      end

      context 'with default delete_scope (no scope specified)' do
        it 'calls DeleteThisTransfer operation' do
          expect(delete_this_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock

          result = operation.call(valid_params)
          expect(result).to be_success
          expect(result.value!).to eq(transfer)
        end
      end

      context 'with delete_scope: "this_only"' do
        let(:params_this_only) { valid_params.merge(delete_scope: "this_only") }

        it 'calls DeleteThisTransfer operation' do
          expect(delete_this_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock

          result = operation.call(params_this_only)
          expect(result).to be_success
          expect(result.value!).to eq(transfer)
        end
      end

      context 'with delete_scope: "this_and_future"' do
        let(:params_this_and_future) { valid_params.merge(delete_scope: "this_and_future") }

        it 'calls DeleteThisAndFutureTransfers operation' do
          expect(delete_this_and_future_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock

          result = operation.call(params_this_and_future)
          expect(result).to be_success
          expect(result.value!).to eq(transfer)
        end
      end

      context 'with delete_scope: "all_in_series"' do
        let(:params_all_in_series) { valid_params.merge(delete_scope: "all_in_series") }

        it 'calls DeleteAllInSeriesTransfers operation' do
          expect(delete_all_in_series_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock

          result = operation.call(params_all_in_series)
          expect(result).to be_success
          expect(result.value!).to eq(transfer)
        end
      end

      context 'when delete operation fails' do
        it 'propagates the failure from DeleteThisTransfer' do
          expect(delete_this_operation).to receive(:call).with(transfer:).and_return(Failure(error: "delete failed")) # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock

          result = operation.call(valid_params)
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end

        it 'propagates the failure from DeleteThisAndFutureTransfers' do
          params_this_and_future = valid_params.merge(delete_scope: "this_and_future")
          expect(delete_this_and_future_operation).to receive(:call).with(transfer:).and_return(Failure(error: "delete failed")) # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock

          result = operation.call(params_this_and_future)
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end

        it 'propagates the failure from DeleteAllInSeriesTransfers' do
          params_all_in_series = valid_params.merge(delete_scope: "all_in_series")
          expect(delete_all_in_series_operation).to receive(:call).with(transfer:).and_return(Failure(error: "delete failed")) # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock

          result = operation.call(params_all_in_series)
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end
      end

      context 'when delete operation succeeds' do
        it 'returns the transfer from DeleteThisTransfer' do
          expect(delete_this_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock

          result = operation.call(valid_params)
          expect(result).to be_success
          expect(result.value!).to eq(transfer)
        end

        it 'returns the transfer from DeleteThisAndFutureTransfers' do
          params_this_and_future = valid_params.merge(delete_scope: "this_and_future")
          expect(delete_this_and_future_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock

          result = operation.call(params_this_and_future)
          expect(result).to be_success
          expect(result.value!).to eq(transfer)
        end

        it 'returns the transfer from DeleteAllInSeriesTransfers' do
          params_all_in_series = valid_params.merge(delete_scope: "all_in_series")
          expect(delete_all_in_series_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock # rubocop:disable RSpec/StubbedMock

          result = operation.call(params_all_in_series)
          expect(result).to be_success
          expect(result.value!).to eq(transfer)
        end
      end
    end

    context 'with invalid parameters' do
      it 'returns validation error for invalid delete_scope' do
        result = operation.call({
          id: transfer.id,
          space_id: space.id,
          delete_scope: "invalid_scope"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:delete_scope)
      end
    end
  end

  describe '#find_transfer' do
    it 'finds the transfer successfully' do
      result = operation.send(:find_transfer, params: { id: transfer.id, space_id: space.id })
      expect(result).to be_success
      expect(result.value!).to eq(transfer)
    end

    it 'returns failure when transfer is not found' do
      result = operation.send(:find_transfer, params: { id: "non-existent", space_id: space.id })
      expect(result).to be_failure
      expect(result.failure).to include(:id)
    end

    it 'returns failure when transfer exists but in different space' do
      other_space = create(:personal_space)
      result = operation.send(:find_transfer, params: { id: transfer.id, space_id: other_space.id })
      expect(result).to be_failure
      expect(result.failure).to include(:id)
    end
  end

  describe '#determine_action' do
    let(:delete_this_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisTransfer) }
    let(:delete_this_and_future_operation) { instance_double(Transactions::Operations::Transfers::DeleteThisAndFutureTransfers) }
    let(:delete_all_in_series_operation) { instance_double(Transactions::Operations::Transfers::DeleteAllInSeriesTransfers) }

    before do
      allow(Transactions::Operations::Transfers::DeleteThisTransfer).to receive(:new).and_return(delete_this_operation)
      allow(Transactions::Operations::Transfers::DeleteThisAndFutureTransfers).to receive(:new).and_return(delete_this_and_future_operation)
      allow(Transactions::Operations::Transfers::DeleteAllInSeriesTransfers).to receive(:new).and_return(delete_all_in_series_operation)
    end

    context 'when delete_scope is "this_only"' do
      it 'calls DeleteThisTransfer operation' do
        expect(delete_this_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock

        result = operation.send(:determine_action, params: { delete_scope: "this_only" }, transfer:)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is "this_and_future"' do
      it 'calls DeleteThisAndFutureTransfers operation' do
        expect(delete_this_and_future_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock

        result = operation.send(:determine_action, params: { delete_scope: "this_and_future" }, transfer:)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is "all_in_series"' do
      it 'calls DeleteAllInSeriesTransfers operation' do
        expect(delete_all_in_series_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock

        result = operation.send(:determine_action, params: { delete_scope: "all_in_series" }, transfer:)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is nil or empty' do
      it 'defaults to DeleteThisTransfer operation' do
        expect(delete_this_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock

        result = operation.send(:determine_action, params: {}, transfer:)
        expect(result).to be_success
      end

      it 'defaults to DeleteThisTransfer operation when delete_scope is empty string' do
        expect(delete_this_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock

        result = operation.send(:determine_action, params: { delete_scope: "" }, transfer:)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is any other value' do
      it 'defaults to DeleteThisTransfer operation' do
        expect(delete_this_operation).to receive(:call).with(transfer:).and_return(Success(transfer)) # rubocop:disable RSpec/StubbedMock

        result = operation.send(:determine_action, params: { delete_scope: "unknown_scope" }, transfer:)
        expect(result).to be_success
      end
    end

    context 'when the called operation fails' do
      it 'propagates the failure from DeleteThisTransfer' do
        expect(delete_this_operation).to receive(:call).with(transfer:).and_return(Failure(error: "delete failed")) # rubocop:disable RSpec/StubbedMock

        result = operation.send(:determine_action, params: { delete_scope: "this_only" }, transfer:)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end

      it 'propagates the failure from DeleteThisAndFutureTransfers' do
        expect(delete_this_and_future_operation).to receive(:call).with(transfer:).and_return(Failure(error: "delete failed")) # rubocop:disable RSpec/StubbedMock

        result = operation.send(:determine_action, params: { delete_scope: "this_and_future" }, transfer:)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end

      it 'propagates the failure from DeleteAllInSeriesTransfers' do
        expect(delete_all_in_series_operation).to receive(:call).with(transfer:).and_return(Failure(error: "delete failed")) # rubocop:disable RSpec/StubbedMock

        result = operation.send(:determine_action, params: { delete_scope: "all_in_series" }, transfer:)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end
  end
end
