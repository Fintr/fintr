# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::DeleteThisTransaction do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:category) { create(:category, space:, category_type: "expense", name: "Groceries") }

  describe '#validate' do
    context 'with valid parameters' do
      let(:transaction) { create(:transaction, user:, space:, account:, category:) }

      it 'succeeds validation' do
        result = operation.validate(params: { transaction: transaction })
        expect(result).to be_success
        expect(result.value!).to eq({ transaction: transaction })
      end
    end

    context 'with invalid parameters' do
      it 'fails when transaction is missing' do
        expect { operation.validate(params: {}) }.to raise_error(ArgumentError)
      end

      it 'fails when transaction is not a Transaction object' do
        result = operation.validate(params: { transaction: "not a transaction" })
        expect(result).to be_failure
        expect(result.failure).to include(transaction: ["must be a transaction"])
      end
    end
  end

  describe '#call' do
    context 'with valid transaction' do
      let(:transaction) { create(:transaction, user:, space:, account:, category:, amount: Money.from_amount(100, "PHP")) }

      context 'when transaction has calculated balance state' do
        before do
          transaction.update!(balance_state: "calculated")
        end

        it 'deletes the transaction and reverts the balance' do
          initial_balance = account.balance
          transaction_value = transaction.value

          result = operation.call(transaction: transaction)
          expect(result).to be_success

          # Verify transaction is deleted
          expect { transaction.reload }.to raise_error(ActiveRecord::RecordNotFound)

          # Verify balance is reverted
          account.reload
          expect(account.balance).to eq(initial_balance - transaction_value)
        end

        it 'returns the deleted transaction' do
          result = operation.call(transaction: transaction)
          expect(result).to be_success
          expect(result.value!).to eq(transaction)
        end
      end

      context 'when transaction amount currency differs from account balance currency' do
        let(:usd_account) do
          create(
            :account,
            name: "USD Wallet",
            space:,
            balance: Money.from_amount(1000, "USD")
          )
        end
        let(:transaction) do
          create(
            :transaction,
            user:,
            space:,
            account: usd_account,
            category:,
            amount: Money.from_amount(100, "PHP"),
            balance_state: "calculated"
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

        it 'reverts balance using FetchRate, not Money::Bank' do
          result = operation.call(transaction: transaction)
          expect(result).to be_success

          expect { transaction.reload }.to raise_error(ActiveRecord::RecordNotFound)
          usd_account.reload
          reverted = (
            BigDecimal("1000") - (BigDecimal("100") / BigDecimal("58")).round(2)
          ).round(2)
          expect(usd_account.balance).to eq(Money.from_amount(reverted, "USD"))
        end
      end

      context 'when transaction has pending balance state' do
        before do
          transaction.update!(balance_state: "pending")
        end

        it 'deletes the transaction without reverting balance' do
          initial_balance = account.balance

          result = operation.call(transaction: transaction)
          expect(result).to be_success

          # Verify transaction is deleted
          expect { transaction.reload }.to raise_error(ActiveRecord::RecordNotFound)

          # Verify balance is not changed
          account.reload
          expect(account.balance).to eq(initial_balance)
        end

        it 'returns the deleted transaction' do
          result = operation.call(transaction: transaction)
          expect(result).to be_success
          expect(result.value!).to eq(transaction)
        end
      end

      context 'when transaction has a transfer' do
        let!(:from_account) { create(:account, space:, balance: Money.from_amount(100, "PHP")) }
        let!(:to_account) { create(:account, space:, balance: Money.from_amount(100, "PHP")) }
        let!(:transfer) { create(:transfer, space:, user:, from_account:, to_account:, transaction_cost: Money.from_amount(100, "PHP")) }
        let!(:transfer_transaction) do
          create(
            :expense_transaction,
            :one_time,
            space:,
            transfer:,
            account: from_account,
            balance_state: "calculated",
            amount: Money.from_amount(100, "PHP")
          )
        end

        it 'deletes the transaction and updates transfer transaction cost to zero' do
          initial_from_balance = from_account.balance
          transaction_value = transfer_transaction.value

          result = operation.call(transaction: transfer_transaction)
          expect(result).to be_success

          # Verify transaction is deleted
          expect { transfer_transaction.reload }.to raise_error(ActiveRecord::RecordNotFound)

          # Verify balance is reverted
          from_account.reload
          expect(from_account.balance).to eq(initial_from_balance - transaction_value)

          # Verify transfer transaction cost is set to zero
          transfer.reload
          expect(transfer.transaction_cost).to eq(Money.from_amount(0, "PHP"))
        end

        it 'returns the deleted transaction' do
          result = operation.call(transaction: transfer_transaction)
          expect(result).to be_success
          expect(result.value!).to eq(transfer_transaction)
        end
      end
    end

    context 'with invalid transaction' do
      it 'returns validation failure' do
        result = operation.call(transaction: "invalid")
        expect(result).to be_failure
        expect(result.failure).to include(transaction: ["must be a transaction"])
      end
    end

    context 'when account balance revert fails' do
      let(:transaction) { create(:transaction, user:, space:, account:, category:, balance_state: "calculated") }

      it 'rolls back the transaction' do
        allow(account).to receive(:save!).and_raise(StandardError.new("Save failed"))

        expect { operation.call(transaction: transaction) }.to raise_error(StandardError, "Save failed")

        # Verify transaction is not deleted due to rollback
        expect(transaction.reload).to be_present
      end
    end

    context 'when transaction destroy fails' do
      let(:transaction) { create(:transaction, user:, space:, account:, category:) }

      it 'rolls back the transaction' do
        allow(transaction).to receive(:destroy!).and_raise(StandardError.new("Destroy failed"))

        expect { operation.call(transaction: transaction) }.to raise_error(StandardError, "Destroy failed")

        # Verify transaction is not deleted due to rollback
        expect(transaction.reload).to be_present
      end
    end
  end

  describe 'Private Methods' do
    describe '#revert_calculated_balance' do
      let(:transaction) { create(:transaction, user:, space:, account:, category:, amount: Money.from_amount(100, "PHP")) }

      it 'reverts the account balance and saves' do
        initial_balance = account.balance
        transaction_value = transaction.value

        result = operation.send(:revert_calculated_balance, transaction: transaction)
        expect(result).to be_success

        account.reload
        expect(account.balance).to eq(initial_balance - transaction_value)
        expect(result.value!).to eq(account)
      end

      it 'raises error when account save fails' do
        allow(account).to receive(:save!).and_raise(StandardError.new("Save failed"))

        expect { operation.send(:revert_calculated_balance, transaction: transaction) }.to raise_error(StandardError, "Save failed")
      end
    end

    describe '#delete_transaction' do
      let(:transaction) { create(:transaction, user:, space:, account:, category:) }

      it 'destroys the transaction and returns success' do
        result = operation.send(:delete_transaction, transaction: transaction)
        expect(result).to be_success
        expect(result.value!).to eq(transaction)

        # Verify transaction is deleted
        expect { transaction.reload }.to raise_error(ActiveRecord::RecordNotFound)
      end

      it 'raises error when destroy fails' do
        allow(transaction).to receive(:destroy!).and_raise(StandardError.new("Destroy failed"))

        expect { operation.send(:delete_transaction, transaction: transaction) }.to raise_error(StandardError, "Destroy failed")
      end
    end

    describe '#update_transfer_transaction_cost' do
      let(:from_account) { create(:account, space:) }
      let(:to_account) { create(:account, space:) }
      let(:transfer) { create(:transfer, space:, user:, from_account:, to_account:) }
      let(:transfer_transaction) { create(:expense_transaction, :one_time, space:, transfer:) }

      it 'updates transfer transaction cost to zero and saves' do
        # Set initial transaction cost
        transfer.update!(transaction_cost: Money.from_amount(50, "PHP"))

        result = operation.send(:update_transfer_transaction_cost, transaction: transfer_transaction)
        expect(result).to be_success
        expect(result.value!).to eq(transfer)

        # Verify transfer transaction cost is set to zero
        transfer.reload
        expect(transfer.transaction_cost).to eq(Money.from_amount(0, "PHP"))
      end

      it 'saves the transfer after updating cost' do
        transfer.update!(transaction_cost: Money.from_amount(100, "PHP"))

        result = operation.send(:update_transfer_transaction_cost, transaction: transfer_transaction)
        expect(result).to be_success

        transfer.reload
        expect(transfer.transaction_cost).to eq(Money.from_amount(0, "PHP"))
      end

      it 'raises error when transfer save fails' do
        allow(transfer).to receive(:save!).and_raise(StandardError.new("Save failed"))

        expect { operation.send(:update_transfer_transaction_cost, transaction: transfer_transaction) }.to raise_error(StandardError, "Save failed")
      end
    end
  end

  describe 'Integration Tests' do
    context 'with income transaction' do
      let(:income_category) { create(:category, space:, category_type: "income", name: "Salary") }
      let(:transaction) { create(:transaction, user:, space:, account:, category: income_category, amount: Money.from_amount(200, "PHP"), balance_state: "calculated") }

      it 'correctly reverts income transaction' do
        initial_balance = account.balance
        transaction_value = transaction.value

        result = operation.call(transaction: transaction)
        expect(result).to be_success

        account.reload
        expect(account.balance).to eq(initial_balance - transaction_value)
      end
    end

    context 'with expense transaction' do
      let(:expense_category) { create(:category, space:, category_type: "expense", name: "Food") }
      let(:transaction) { create(:transaction, user:, space:, account:, category: expense_category, amount: Money.from_amount(50, "PHP"), balance_state: "calculated") }

      it 'correctly reverts expense transaction' do
        initial_balance = account.balance
        transaction_value = transaction.value

        result = operation.call(transaction: transaction)
        expect(result).to be_success

        account.reload
        expect(account.balance).to eq(initial_balance - transaction_value)
      end
    end

    context 'with different transaction types' do
      let(:transaction) { create(:transaction, user:, space:, account:, category:, amount: Money.from_amount(75, "PHP"), balance_state: "calculated") }

      it 'correctly reverts any transaction type' do
        initial_balance = account.balance
        transaction_value = transaction.value

        result = operation.call(transaction: transaction)
        expect(result).to be_success

        account.reload
        expect(account.balance).to eq(initial_balance - transaction_value)
      end
    end

    context 'with large amount transaction' do
      let(:transaction) { create(:transaction, user:, space:, account:, category:, amount: Money.from_amount(10000, "PHP"), balance_state: "calculated") }

      it 'handles large amounts correctly' do
        initial_balance = account.balance
        transaction_value = transaction.value

        result = operation.call(transaction: transaction)
        expect(result).to be_success

        account.reload
        expect(account.balance).to eq(initial_balance - transaction_value)
      end
    end
  end
end
