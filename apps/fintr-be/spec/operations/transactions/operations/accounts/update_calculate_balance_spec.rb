# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Accounts::UpdateCalculateBalance do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:account_one) { create(:account, space: space, balance: 1000.00) }
  let!(:account_two) { create(:account, space: space, balance: 500.00) }

  describe '#call' do
    context 'with valid parameters' do
      context 'when updating an income transaction' do
        let!(:transaction) do
          create(:income_transaction,
                 account: account_one,
                 space: space,
                 amount: 200.00)
        end

        let(:updated_transaction) do
          transaction.tap do |t|
            t.amount = 300.00
            t.description = "Updated Income"
          end
        end

        let(:params) do
          {
            transaction: updated_transaction
          }
        end

        it 'updates the account balance correctly' do
          current_account_one_balance = account_one.balance.amount
          result = operation.call(params)

          returned_transaction = result.value!

          expect(result).to be_success
          expect(account_one.reload.balance).to eq(Money.from_amount(1000.00 - 200.00 + 300.00, "PHP"))
          expect(returned_transaction.description).to eq("Updated Income")
        end
      end

      context 'when updating an expense transaction and changing account' do
        let!(:original_transaction) do
          create(:expense_transaction,
                 account: account_one,
                 space: space,
                 amount: 150.00)
        end

        let(:updated_transaction) do
          original_transaction.tap do |t|
            t.account = account_two # Change account
            t.amount = 250.00 # Change amount
            t.description = "Updated Expense and Account"
          end
        end

        let(:params) do
          {
            transaction: updated_transaction
          }
        end

        it 'updates both account balances correctly' do
          current_account_one_balance = account_one.balance.amount
          current_account_two_balance = account_two.balance.amount

          result = operation.call(params)
          returned_transaction = result.value!

          expect(result).to be_success
          # Previous account (account_one) should have original expense amount added back
          expect(account_one.reload.balance).to eq(Money.from_amount(current_account_one_balance + 150.00, "PHP"))
          # Current account (account_two) should have new expense amount subtracted
          expect(account_two.reload.balance).to eq(Money.from_amount(current_account_two_balance - 250.00, "PHP"))
          expect(returned_transaction.account_id).to eq(account_two.id)
          expect(returned_transaction.description).to eq("Updated Expense and Account")
        end
      end
    end

    context 'with invalid parameters' do
      context 'when transaction is missing' do
        let(:params) { { transaction: nil } }

        it 'returns validation failure' do
          result = operation.call(params)

          expect(result).to be_failure
          expect(result.failure).to have_key(:transaction)
          expect(result.failure[:transaction]).to include("must be filled")
        end
      end

      context 'when transaction is not a Transactions::Transaction object' do
        let(:params) { { transaction: create(:user) } }

        it 'returns validation failure' do
          result = operation.call(params)

          expect(result).to be_failure
          expect(result.failure).to have_key(:transaction)
          expect(result.failure[:transaction]).to include("must be a transaction")
        end
      end

      context 'when transaction has no changes' do
        let(:unchanged_transaction) do
          create(:income_transaction,
                 account: account_one,
                 space: space,
                 amount: 200.00)
        end

        let(:params) do
          {
            transaction: unchanged_transaction
          }
        end

        it 'returns validation failure' do
          result = operation.call(params)

          expect(result).to be_failure
          expect(result.failure).to have_key(:transaction)
          expect(result.failure[:transaction]).to include("must be a transaction with changes")
        end
      end

      context 'when previous account is not found' do
        let!(:transaction) do
          create(:income_transaction,
                 account: account_one,
                 space: space,
                 amount: 200.00)
        end

        let(:updated_transaction) do
          transaction.tap do |t|
            allow(t).to receive(:account_id_was).and_return(SecureRandom.uuid) # Simulate previous account_id
            t.description = "changed to trigger validation" # Ensure transaction is considered changed
          end
        end

        let(:params) do
          {
            transaction: updated_transaction
          }
        end

        before do
          allow(operation).to receive(:find_account).with(id: updated_transaction.account_id_was)
            .and_return(Dry::Monads::Result::Failure.new(account: "not found"))
          allow(operation).to receive(:find_account).with(id: updated_transaction.account_id)
            .and_return(Dry::Monads::Result::Success.new(account_one))
        end

        it 'returns account not found error for previous account' do
          result = operation.call(params)

          expect(result).to be_failure
          expect(result.failure).to include(account: "not found")
        end
      end

      context 'when current account is not found' do
        let!(:transaction) do
          create(:income_transaction,
                 account: account_one,
                 space: space,
                 amount: 200.00)
        end

        let(:updated_transaction) do
          transaction.tap do |t|
            t.account_id = SecureRandom.uuid # Simulate current account not found
          end
        end

        let(:params) do
          {
            transaction: updated_transaction
          }
        end

        it 'returns account not found error for current account' do
          result = operation.call(params)

          expect(result).to be_failure
          expect(result.failure).to include(account: "not found")
        end
      end
    end

    context 'with ActiveRecord errors during balance update' do
      let!(:transaction) do
        create(:income_transaction,
               account: account_one,
               space: space,
               amount: 200.00)
      end

      let(:updated_transaction) do
        transaction.tap do |t|
          t.amount = 300.00
        end
      end

      let(:params) do
        {
          transaction: updated_transaction
        }
      end

      it 'returns a failure when previous account balance update fails' do
        allow(operation).to receive(:update_balance)
          .with(from: :previous, transaction: updated_transaction, account: instance_of(Transactions::Account))
          .and_return(Dry::Monads::Result::Failure.new(account: "failed to save"))

        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(account: "failed to save")
      end

      it 'returns a failure when current account balance update fails' do
        allow(operation).to receive(:update_balance)
          .with(from: :previous, transaction: updated_transaction, account: instance_of(Transactions::Account))
          .and_return(Dry::Monads::Result::Success.new(account_one.reload))
        allow(operation).to receive(:update_balance)
          .with(from: :current, transaction: updated_transaction, account: instance_of(Transactions::Account))
          .and_return(Dry::Monads::Result::Failure.new(account: "failed to save"))

        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(account: "failed to save")
      end
    end
  end

  describe 'private methods' do
    let!(:transaction) do
      create(:income_transaction,
             account: account_one,
             space: space,
             amount: 200.00)
    end

    let(:updated_transaction) do
      transaction.tap do |t|
        t.amount = 300.00
        t.account = account_two
      end
    end

    describe '#dig_transaction' do
      it 'returns success with the transaction from params' do
        params = { transaction: updated_transaction }
        result = operation.send(:dig_transaction, params: params)
        expect(result).to be_success
        expect(result.value!).to eq(updated_transaction)
      end
    end

    describe '#find_account' do
      it 'returns success with the account when found' do
        result = operation.send(:find_account, id: account_one.id)
        expect(result).to be_success
        expect(result.value!).to eq(account_one)
      end

      it 'returns failure when account is not found' do
        result = operation.send(:find_account, id: SecureRandom.uuid)
        expect(result).to be_failure
        expect(result.failure).to include(account: "not found")
      end
    end

    describe '#update_balance' do
      context 'when updating previous account balance for income' do
        it 'decreases the account balance' do
          current_balance = account_one.balance.amount
          result = operation.send(:update_balance,
                                  from: :previous,
                                  transaction: updated_transaction,
                                  account: account_one)
          expect(result).to be_success
          expect(account_one.reload.balance.amount).to eq(current_balance - 200.00)
        end
      end

      context 'when updating previous account balance for expense' do
        let!(:expense_transaction) do
          create(:expense_transaction,
                 account: account_one,
                 space: space,
                 amount: 200.00)
        end

        it 'increases the account balance' do
          current_balance = account_one.balance.amount
          result = operation.send(:update_balance,
                                  from: :previous,
                                  transaction: expense_transaction,
                                  account: account_one)
          expect(result).to be_success
          expect(account_one.reload.balance.amount).to eq(current_balance + 200.00)
        end
      end

      context 'when updating current account balance for income' do
        it 'increases the account balance' do
          current_balance = account_two.balance.amount
          result = operation.send(:update_balance,
                                  from: :current,
                                  transaction: updated_transaction,
                                  account: account_two)
          expect(result).to be_success
          expect(account_two.reload.balance.amount).to eq(current_balance + 300.00)
        end
      end

      context 'when updating current account balance for expense' do
        let!(:expense_transaction) do
          create(:expense_transaction,
                 account: account_two,
                 space: space,
                 amount: 200.00)
        end

        let(:updated_expense_transaction) do
          expense_transaction.tap do |t|
            t.amount = 300.00
          end
        end

        it 'decreases the account balance' do
          current_balance = account_two.balance.amount
          result = operation.send(:update_balance,
                                  from: :current,
                                  transaction: updated_expense_transaction,
                                  account: account_two)
          expect(result).to be_success
          expect(account_two.reload.balance.amount).to eq(current_balance - 300.00)
        end
      end

      it 'returns failure for unsupported action' do
        result = operation.send(:update_balance,
                                from: :unsupported,
                                transaction: updated_transaction,
                                account: account_one)
        expect(result).to be_failure
        expect(result.failure).to include(action: "not supported")
      end

      it 'returns failure when account save fails' do
        allow(account_one).to receive(:save!).and_raise(StandardError, "Failed to save")

        result = operation.send(:update_balance,
                                from: :previous,
                                transaction: updated_transaction,
                                account: account_one)
        expect(result).to be_failure
        expect(result.failure).to include(account: "failed to save")
      end
    end

    describe '#skip_previous_revert?' do
      it 'skips revert when a calculated row never received a running balance snapshot' do
        transaction = create(
          :expense_transaction,
          account: account_one,
          space: space,
          amount: 200.00,
          balance: Money.from_amount(0, "PHP"),
          balance_state: "calculated"
        )
        transaction.account = account_two

        expect(operation.send(:skip_previous_revert?, transaction:)).to be(true)
      end
    end
  end
end
