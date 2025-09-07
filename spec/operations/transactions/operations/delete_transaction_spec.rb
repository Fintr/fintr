# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::DeleteTransaction do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:category) { create(:category, space:, category_type: "expense", name: "Groceries") }
  let(:transaction) do
    create(:expense_transaction,
           user:,
           space:,
           account:,
           category:,
           amount: Money.from_amount(100, "PHP"),
           date: Time.zone.today)
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when id is missing' do
        result = operation.validate(params: { id: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end
    end

    context 'with invalid delete_scope' do
      it 'fails when delete_scope is not one of the valid options' do
        result = operation.validate(params: {
          id: transaction.id,
          delete_scope: "invalid_scope"
        })
        expect(result).to be_failure
        expect(result.failure[:delete_scope]).to include("must be one of: this_only, this_and_future, all_in_series")
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation with id only' do
        result = operation.validate(params: { id: transaction.id })
        expect(result).to be_success
      end

      it 'succeeds validation with valid delete_scope' do
        result = operation.validate(params: {
          id: transaction.id,
          delete_scope: "this_only"
        })
        expect(result).to be_success
      end

      it 'succeeds validation with this_and_future scope' do
        result = operation.validate(params: {
          id: transaction.id,
          delete_scope: "this_and_future"
        })
        expect(result).to be_success
      end

      it 'succeeds validation with all_in_series scope' do
        result = operation.validate(params: {
          id: transaction.id,
          delete_scope: "all_in_series"
        })
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    let(:delete_this_operation) { instance_double(Transactions::Operations::DeleteThisTransaction) }
    let(:delete_this_and_future_operation) { instance_double(Transactions::Operations::DeleteThisAndFutureTransactions) }
    let(:delete_all_in_series_operation) { instance_double(Transactions::Operations::DeleteAllInSeriesTransactions) }

    before do
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_this_operation)
      allow(Transactions::Operations::DeleteThisAndFutureTransactions).to receive(:new).and_return(delete_this_and_future_operation)
      allow(Transactions::Operations::DeleteAllInSeriesTransactions).to receive(:new).and_return(delete_all_in_series_operation)
      allow(delete_this_operation).to receive(:call).and_return(Success(transaction))
      allow(delete_this_and_future_operation).to receive(:call).and_return(Success(transaction))
      allow(delete_all_in_series_operation).to receive(:call).and_return(Success(transaction))
    end

    context 'when validation fails' do
      it 'returns validation failure for missing id' do
        result = operation.call({ id: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end

      it 'returns validation failure for invalid delete_scope' do
        result = operation.call({
          id: transaction.id,
          delete_scope: "invalid_scope"
        })
        expect(result).to be_failure
        expect(result.failure[:delete_scope]).to include("must be one of: this_only, this_and_future, all_in_series")
      end
    end

    context 'when transaction is not found' do
      it 'returns not found error' do
        result = operation.call({ id: "non-existent-id" })
        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end
    end

    context 'with valid parameters' do
      it 'returns the transaction when successful' do
        result = operation.call({ id: transaction.id })
        expect(result).to be_success
        expect(result.value!).to eq(transaction)
      end
    end

    context 'with delete_scope: this_only' do
      it 'calls DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.call({
          id: transaction.id,
          delete_scope: "this_only"
        })
        expect(result).to be_success
      end
    end

    context 'with delete_scope: this_and_future' do
      it 'calls DeleteThisAndFutureTransactions operation' do
        expect(delete_this_and_future_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.call({
          id: transaction.id,
          delete_scope: "this_and_future"
        })
        expect(result).to be_success
      end
    end

    context 'with delete_scope: all_in_series' do
      it 'calls DeleteAllInSeriesTransactions operation' do
        expect(delete_all_in_series_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.call({
          id: transaction.id,
          delete_scope: "all_in_series"
        })
        expect(result).to be_success
      end
    end

    context 'when delete_scope is not specified' do
      it 'defaults to calling DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.call({ id: transaction.id })
        expect(result).to be_success
      end
    end

    context 'when delete_scope is empty string' do
      it 'defaults to calling DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.call({
          id: transaction.id,
          delete_scope: ""
        })
        expect(result).to be_success
      end
    end

    context 'when delegated operation fails' do
      it 'propagates failure from DeleteThisTransaction' do
        allow(delete_this_operation).to receive(:call).and_return(Failure(error: "delete failed"))

        result = operation.call({
          id: transaction.id,
          delete_scope: "this_only"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end

      it 'propagates failure from DeleteThisAndFutureTransactions' do
        allow(delete_this_and_future_operation).to receive(:call).and_return(Failure(error: "delete failed"))

        result = operation.call({
          id: transaction.id,
          delete_scope: "this_and_future"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end

      it 'propagates failure from DeleteAllInSeriesTransactions' do
        allow(delete_all_in_series_operation).to receive(:call).and_return(Failure(error: "delete failed"))

        result = operation.call({
          id: transaction.id,
          delete_scope: "all_in_series"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end
  end

  describe '#find_transaction' do
    it 'returns the transaction when found' do
      result = operation.send(:find_transaction, params: { id: transaction.id })
      expect(result).to be_success
      expect(result.value!).to eq(transaction)
    end

    it 'returns failure when transaction is not found' do
      result = operation.send(:find_transaction, params: { id: "non-existent-id" })
      expect(result).to be_failure
      expect(result.failure).to include(:id)
    end
  end

  describe '#determine_action' do
    let(:delete_this_operation) { instance_double(Transactions::Operations::DeleteThisTransaction) }
    let(:delete_this_and_future_operation) { instance_double(Transactions::Operations::DeleteThisAndFutureTransactions) }
    let(:delete_all_in_series_operation) { instance_double(Transactions::Operations::DeleteAllInSeriesTransactions) }

    before do
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_this_operation)
      allow(Transactions::Operations::DeleteThisAndFutureTransactions).to receive(:new).and_return(delete_this_and_future_operation)
      allow(Transactions::Operations::DeleteAllInSeriesTransactions).to receive(:new).and_return(delete_all_in_series_operation)
      allow(delete_this_operation).to receive(:call).and_return(Success(transaction))
      allow(delete_this_and_future_operation).to receive(:call).and_return(Success(transaction))
      allow(delete_all_in_series_operation).to receive(:call).and_return(Success(transaction))
    end

    context 'when delete_scope is this_only' do
      it 'calls DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: { delete_scope: "this_only" },
                               transaction: transaction)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is this_and_future' do
      it 'calls DeleteThisAndFutureTransactions operation' do
        expect(delete_this_and_future_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: { delete_scope: "this_and_future" },
                               transaction: transaction)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is all_in_series' do
      it 'calls DeleteAllInSeriesTransactions operation' do
        expect(delete_all_in_series_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: { delete_scope: "all_in_series" },
                               transaction: transaction)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is not specified' do
      it 'defaults to calling DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: {},
                               transaction: transaction)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is empty string' do
      it 'defaults to calling DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: { delete_scope: "" },
                               transaction: transaction)
        expect(result).to be_success
      end
    end

    context 'when delete_scope is some other value' do
      it 'defaults to calling DeleteThisTransaction operation' do
        expect(delete_this_operation).to receive(:call).with(transaction: transaction).and_return(Success(transaction))

        result = operation.send(:determine_action,
                               params: { delete_scope: "some_other_value" },
                               transaction: transaction)
        expect(result).to be_success
      end
    end
  end
end
