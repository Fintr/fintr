# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::DeleteAllInSeriesTransactions do
  include Dry::Monads[:result]
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:category) { create(:category, space:, category_type: "expense", name: "Groceries") }
  let(:parent_transaction) do
    create(:transaction, :repeat,
           user:,
           space:,
           account:,
           category:,
           amount: Money.from_amount(100, "PHP"),
           date: Time.zone.today,
           repeat_interval: "every_month",
           repeat_count: 5)
  end
  let!(:series_transactions) do
    [
      parent_transaction,
      create(:transaction, :repeat,
             user:,
             space:,
             account:,
             category:,
             amount: Money.from_amount(100, "PHP"),
             date: Time.zone.today + 1.week,
             parent: parent_transaction,
             repeat_interval: "every_month",
             repeat_count: 5),
      create(:transaction, :repeat,
             user:,
             space:,
             account:,
             category:,
             amount: Money.from_amount(100, "PHP"),
             date: Time.zone.today + 2.weeks,
             parent: parent_transaction,
             repeat_interval: "every_month",
             repeat_count: 5)
    ]
  end

  describe '#call' do
    let(:valid_params) do
      {
        transaction: parent_transaction
      }
    end

    let(:delete_this_operation) { instance_double(Transactions::Operations::DeleteThisTransaction) }

    before do
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_this_operation)
    end

    context 'with invalid parameters' do
      it 'returns validation error for missing transaction' do
        result = operation.call({ something: "invalid" })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction)
      end

      it 'returns validation error for invalid transaction' do
        result = operation.call({
          transaction: "not_a_transaction"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:transaction)
      end
    end

    context 'with valid parameters' do
      context 'when except_this_transaction is not specified (defaults to false)' do
        it 'deletes all transactions in the series including the parent' do
          expect(delete_this_operation).to receive(:call).with(any_args).exactly(3).times.and_return(Success(parent_transaction))

          result = operation.call(valid_params)
          expect(result).to be_success
          expect(result.value!).to eq(parent_transaction)
        end
      end

      context 'when except_this_transaction is false' do
        let(:params_with_except_false) { valid_params.merge(except_this_transaction: false) }

        it 'deletes all transactions in the series including the parent' do
          expect(delete_this_operation).to receive(:call).with(any_args).exactly(3).times.and_return(Success(parent_transaction))

          result = operation.call(params_with_except_false)
          expect(result).to be_success
          expect(result.value!).to eq(parent_transaction)
        end
      end

      context 'when except_this_transaction is true' do
        let(:params_with_except_true) { valid_params.merge(except_this_transaction: true) }

        it 'deletes all transactions in the series except the parent' do
          expect(delete_this_operation).to receive(:call).with(any_args).twice.and_return(Success(parent_transaction))

          result = operation.call(params_with_except_true)
          expect(result).to be_success
          expect(result.value!).to eq(parent_transaction)
        end
      end

      context 'when series has only one transaction' do
        let(:single_transaction) { create(:transaction, user:, space:, account:, category:) }
        let(:params_single) { { transaction: single_transaction } }

        it 'deletes the transaction when except_this_transaction is false' do
          expect(delete_this_operation).to receive(:call).with(any_args).once.and_return(Success(single_transaction))

          result = operation.call(params_single)
          expect(result).to be_success
          expect(result.value!).to eq(single_transaction)
        end

        it 'does not delete the transaction when except_this_transaction is true' do
          expect(delete_this_operation).not_to receive(:call)

          result = operation.call(params_single.merge(except_this_transaction: true))
          expect(result).to be_success
          expect(result.value!).to eq(single_transaction)
        end
      end

      context 'when delete operation fails' do
        it 'propagates the failure from DeleteThisTransaction' do
          allow(delete_this_operation).to receive(:call).with(any_args).and_return(Failure(error: "delete failed"))

          result = operation.call(valid_params)
          expect(result).to be_failure
          expect(result.failure).to include(:error)
        end
      end
    end
  end
end
