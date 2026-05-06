# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Accounts::CalculateBalance do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:account) { create(:account, space: space, balance: 1000.00) }

  describe '#call' do
    context 'with valid parameters' do
      let(:transaction) do
        create(:transaction,
               account: account,
               space: space,
               amount: 200.00,
               balance_state: 'pending')
      end

      let(:params) do
        {
          transaction_id: transaction.id
        }
      end

      it 'calculates the account balance and updates transaction balance_state' do
        result = operation.call(params)

        expect(result).to be_success
        expect(account.reload.balance.amount).to eq(1200.00)
        expect(transaction.reload.balance.amount).to eq(1200.00)
        expect(transaction.reload.balance_state).to eq('calculated')
      end

      context 'when transaction amount currency differs from account balance currency' do
        let!(:usd_account) do
          create(:account, space: space, balance: Money.from_amount(1000, "USD"))
        end
        let(:transaction) do
          create(
            :transaction,
            account: usd_account,
            space: space,
            amount: Money.from_amount(5800, "PHP"),
            balance_state: 'pending'
          )
        end

        before do
          ExchangeRates::ApiExchangeRate.create!(
            base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
            target_currency: "PHP",
            rate: 58,
            rate_date: transaction.date.to_date
          )
        end

        it 'applies FetchRate so the effect is in account currency' do
          result = operation.call(params)

          expect(result).to be_success
          expected = (BigDecimal("1000") + (BigDecimal("5800") / BigDecimal("58")).round(2)).round(2)
          expect(usd_account.reload.balance.amount).to eq(expected.to_f)
          expect(transaction.reload.balance_state).to eq('calculated')
        end
      end

      context 'when skip_calculation is true' do
        let(:params_skip_calculation) do
          {
            transaction_id: transaction.id,
            skip_calculation: true
          }
        end

        before do
          transaction.update!(balance_state: 'calculated')
        end

        it 'updates transaction balance_state to calculated without recalculating balance' do
          current_balance = account.balance.amount
          result = operation.call(params_skip_calculation)

          expect(result).to be_success
          expect(account.reload.balance.amount).to eq(current_balance)
          expect(transaction.reload.balance_state).to eq('calculated')
        end
      end

      context 'when transaction balance_state is already calculated' do
        before do
          transaction.update!(balance_state: 'calculated')
        end

        it 'does not recalculate the balance' do
          current_balance = account.balance.amount
          result = operation.call(params)

          expect(result).to be_success
          expect(account.reload.balance.amount).to eq(current_balance)
          expect(transaction.reload.balance_state).to eq('calculated')
        end
      end
    end

    context 'with invalid parameters' do
      context 'when transaction_id is missing' do
        let(:params) { { transaction_id: nil } }

        it 'returns validation failure' do
          result = operation.call(params)

          expect(result).to be_failure
          expect(result.failure).to have_key(:transaction_id)
        end
      end

      context 'when transaction_id is not found' do
        let(:params) do
          {
            transaction_id: 'non-existent-id'
          }
        end

        it 'returns transaction not found error' do
          result = operation.call(params)

          expect(result).to be_failure
          expect(result.failure).to include(transaction_id: 'not found')
        end
      end
    end

    context 'with ActiveRecord errors' do
      let(:transaction) do
        create(:transaction,
               account: account,
               space: space,
               amount: 200.00,
               balance_state: 'pending')
      end

      let(:params) do
        {
          transaction_id: transaction.id
        }
      end

      context 'when account save fails' do
        before do
          allow(operation).to receive(:calculate_balance).and_return(
            Dry::Monads::Result::Failure.new(
              account_name: 'Balance cannot be negative. Original balance: $1,000.00. New balance: $1,200.00',
              error: ActiveRecord::ActiveRecordError.new('Account save error')
            )
          )
        end

        it 'returns a failure with ActiveRecord error' do
          result = operation.call(params)

          expect(result).to be_failure
          expect(result.failure).to have_key(:account_name)
          expect(result.failure[:account_name]).to include('Balance cannot be negative')
        end
      end

      context 'when transaction save fails' do
        before do
          allow(operation).to receive(:calculate_balance).and_return(
            Dry::Monads::Result::Failure.new(
              account_name: 'Balance cannot be negative. Original balance: $1,000.00. New balance: $1,200.00',
              error: ActiveRecord::ActiveRecordError.new('Transaction save error')
            )
          )
        end

        it 'returns a failure with ActiveRecord error' do
          result = operation.call(params)

          expect(result).to be_failure
          expect(result.failure).to have_key(:account_name)
          expect(result.failure[:account_name]).to include('Balance cannot be negative')
        end
      end
    end
  end

  describe 'private methods' do
    let(:transaction) do
      create(:transaction,
             account: account,
             space: space,
             amount: 200.00,
             balance_state: 'pending')
    end

    describe '#find_transaction' do
      context 'when transaction is found' do
        let(:params) { { transaction_id: transaction.id } }

        it 'returns success with the transaction' do
          result = operation.send(:find_transaction, params: params)
          expect(result).to be_success
          expect(result.value!).to be_a(Transactions::Income)
          expect(result.value!.id).to eq(transaction.id)
        end
      end

      context 'when transaction is not found' do
        let(:params) { { transaction_id: 'non-existent-id' } }

        it 'returns failure with transaction not found error' do
          result = operation.send(:find_transaction, params: params)
          expect(result).to be_failure
          expect(result.failure).to include(transaction_id: 'not found')
        end
      end
    end

    describe '#find_account' do
      context 'when account is found' do
        it 'returns success with the account' do
          result = operation.send(:find_account, transaction: transaction)
          expect(result).to be_success
          expect(result.value!).to eq(account)
        end
      end

      context 'when account is not found' do
        let(:transaction_with_missing_account) { instance_double(Transactions::Transaction) }

        before do
          allow(transaction_with_missing_account).to receive(:account).and_raise(ActiveRecord::RecordNotFound)
        end

        it 'returns failure with account not found error' do
          result = operation.send(:find_account, transaction: transaction_with_missing_account)
          expect(result).to be_failure
          expect(result.failure).to include(account: 'not found')
        end
      end
    end

    describe '#calculate_balance' do
      context 'when balance_state is pending and skip_calculation is false' do
        it 'updates account and transaction balances' do
          old_account_balance = account.balance.amount
          old_transaction_balance = transaction.balance.amount

          result = operation.send(:calculate_balance,
                                  transaction: transaction,
                                  account: account,
                                  skip_calculation: false)

          expect(result).to be_success
          expect(account.reload.balance.amount).to eq(old_account_balance + transaction.value.amount)
          expect(transaction.reload.balance.amount).to eq(old_account_balance + transaction.value.amount)
          expect(transaction.reload.balance_state).to eq('calculated')
        end
      end

      context 'when skip_calculation is true' do
        before do
          transaction.update!(balance_state: 'calculated')
        end

        it 'updates transaction balance_state to calculated and does not change account balance' do
          old_account_balance = account.balance.amount
          result = operation.send(:calculate_balance,
                                  transaction: transaction,
                                  account: account,
                                  skip_calculation: true)

          expect(result).to be_success
          expect(account.reload.balance.amount).to eq(old_account_balance)
          expect(transaction.reload.balance_state).to eq('calculated')
        end
      end

      context 'when transaction balance_state is already calculated' do
        before do
          transaction.update!(balance_state: 'calculated')
        end

        it 'returns success without re-calculating balance' do
          current_account_balance = account.balance.amount
          current_transaction_balance = transaction.balance.amount

          result = operation.send(:calculate_balance,
                                  transaction: transaction,
                                  account: account,
                                  skip_calculation: false)

          expect(result).to be_success
          expect(account.reload.balance.amount).to eq(current_account_balance)
          expect(transaction.reload.balance.amount).to eq(current_transaction_balance)
          expect(transaction.reload.balance_state).to eq('calculated')
        end
      end
    end
  end
end
