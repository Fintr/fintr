# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Loans::DeleteLoanPayment do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:account) { create(:account, space: space, balance: Money.from_amount(10_000, 'PHP'), name: 'Test Account') }
  let(:entity) { create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender') }

  let(:loan) do
    create(
      :loan,
      user: user,
      space: space,
      entity: entity,
      account: account,
      principal_amount_cents: 100_000_00,
      outstanding_balance_cents: 50_000_00,
      interest_rate: 10.0,
      loan_term_months: 12,
      date: Date.new(2024, 1, 1),
      maturity_date: Date.new(2024, 12, 31),
      loan_type: 'borrowed',
      currency: 'PHP'
    )
  end

  let(:loan_payment) do
    create(
      :loan_payment,
      loan: loan,
      account: account,
      date: Date.new(2024, 2, 1),
      principal_payment: Money.from_amount(7_942.27, 'PHP'),
      interest_payment: Money.from_amount(849.32, 'PHP'),
      total_payment: Money.from_amount(8_791.59, 'PHP'),
      currency: 'PHP'
    )
  end

  let(:valid_params) do
    {
      user_id: user.id.to_s,
      space_id: space.id.to_s,
      loan_payment_id: loan_payment.id.to_s
    }
  end

  describe '#validate' do
    context 'when valid params' do
      it 'returns a successful result' do
        result = operation.validate(params: valid_params)
        expect(result).to be_success
      end

      it 'returns the validated params' do
        result = operation.validate(params: valid_params)
        expect(result.value!).to eq(valid_params)
      end
    end

    context 'when invalid params' do
      it 'returns a failure result when user_id is missing' do
        invalid_params = { space_id: space.id.to_s, loan_payment_id: loan_payment.id.to_s }
        result = operation.validate(params: invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ['is missing'])
      end

      it 'returns a failure result when space_id is missing' do
        invalid_params = { user_id: user.id.to_s, loan_payment_id: loan_payment.id.to_s }
        result = operation.validate(params: invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(space_id: ['is missing'])
      end

      it 'returns a failure result when loan_payment_id is missing' do
        invalid_params = { user_id: user.id.to_s, space_id: space.id.to_s }
        result = operation.validate(params: invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(loan_payment_id: ['is missing'])
      end
    end
  end

  describe '#call' do
    subject(:call_operation) { operation.call(params) }

    let(:params) { valid_params }
    let(:reverse_balance_operation) { instance_double(Transactions::Operations::Loans::ReverseAccountBalanceForLoanPayment) }
    let(:delete_transaction_operation) { instance_double(Transactions::Operations::DeleteThisTransaction) }

    before do
      allow(Transactions::Operations::Loans::ReverseAccountBalanceForLoanPayment).to receive(:new).and_return(reverse_balance_operation)
      allow(reverse_balance_operation).to receive(:call).and_return(Success(account))
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_transaction_operation)
      allow(delete_transaction_operation).to receive(:call).and_return(Success(nil))
    end

    context 'with valid parameters' do
      it { is_expected.to be_success }

      it 'deletes the loan payment' do
        payment_id = loan_payment.id
        call_operation
        expect(Transactions::LoanPayment.find_by(id: payment_id)).to be_nil
      end

      it 'returns the deleted loan payment' do
        result = call_operation.value!
        expect(result).to eq(loan_payment)
        expect { loan_payment.reload }.to raise_error(ActiveRecord::RecordNotFound)
      end

      it 'calls ReverseAccountBalanceForLoanPayment with correct parameters' do
        call_operation
        expect(Transactions::Operations::Loans::ReverseAccountBalanceForLoanPayment).to have_received(:new)
        expect(reverse_balance_operation).to have_received(:call).with(
          loan_payment: loan_payment,
          loan: loan,
          account: account
        )
      end

      it 'recalculates the loan outstanding balance' do
        initial_outstanding = loan.reload.outstanding_balance
        call_operation
        loan.reload
        # Balance should change after payment deletion
        expect(loan.outstanding_balance).not_to eq(initial_outstanding)
      end

      context 'when loan payment has a transaction_record' do
        let!(:interest_transaction) do
          create(
            :expense_transaction,
            user: user,
            space: space,
            account: account,
            balance_state: 'calculated'
          )
        end

        before do
          loan_payment.update!(transaction_id: interest_transaction.id)
        end

        it 'deletes the interest transaction' do
          call_operation
          expect(Transactions::Operations::DeleteThisTransaction).to have_received(:new)
          expect(delete_transaction_operation).to have_received(:call).with(transaction: interest_transaction)
        end
      end

      context 'when loan payment does not have a transaction_record' do
        before do
          loan_payment.update!(transaction_id: nil)
        end

        it 'does not attempt to delete a transaction' do
          call_operation
          expect(delete_transaction_operation).not_to have_received(:call)
        end
      end
    end

    describe 'Validation Failures' do
      context 'when user_id is missing' do
        let(:params) { { space_id: space.id.to_s, loan_payment_id: loan_payment.id.to_s } }

        before do
          allow(Transactions::Operations::Loans::ReverseAccountBalanceForLoanPayment).to receive(:new)
          allow(Transactions::Operations::DeleteThisTransaction).to receive(:new)
        end

        it { is_expected.to be_failure }

        it 'returns user_id missing error' do
          expect(call_operation.failure).to include(user_id: ['is missing'])
        end
      end

      context 'when space_id is missing' do
        let(:params) { { user_id: user.id.to_s, loan_payment_id: loan_payment.id.to_s } }

        before do
          allow(Transactions::Operations::Loans::ReverseAccountBalanceForLoanPayment).to receive(:new)
          allow(Transactions::Operations::DeleteThisTransaction).to receive(:new)
        end

        it { is_expected.to be_failure }

        it 'returns space_id missing error' do
          expect(call_operation.failure).to include(space_id: ['is missing'])
        end
      end

      context 'when loan_payment_id is missing' do
        let(:params) { { user_id: user.id.to_s, space_id: space.id.to_s } }

        before do
          allow(Transactions::Operations::Loans::ReverseAccountBalanceForLoanPayment).to receive(:new)
          allow(Transactions::Operations::DeleteThisTransaction).to receive(:new)
        end

        it { is_expected.to be_failure }

        it 'returns loan_payment_id missing error' do
          expect(call_operation.failure).to include(loan_payment_id: ['is missing'])
        end
      end
    end

    describe 'Step Failures' do
      context 'when loan payment is not found' do
        let(:params) { valid_params.merge(loan_payment_id: SecureRandom.uuid) }

        before do
          allow(Transactions::Operations::Loans::ReverseAccountBalanceForLoanPayment).to receive(:new)
          allow(Transactions::Operations::DeleteThisTransaction).to receive(:new)
        end

        it { is_expected.to be_failure }

        it 'returns loan_payment_id not found error' do
          expect(call_operation.failure).to eq(loan_payment_id: 'not found')
        end
      end

      context 'when loan payment belongs to different space' do
        let(:other_space) { create(:space) }
        let(:other_loan) do
          create(
            :loan,
            user: user,
            space: other_space,
            entity: entity,
            account: account
          )
        end
        let(:other_loan_payment) do
          create(
            :loan_payment,
            loan: other_loan,
            account: account
          )
        end
        let(:params) { valid_params.merge(loan_payment_id: other_loan_payment.id.to_s) }

        before do
          allow(Transactions::Operations::Loans::ReverseAccountBalanceForLoanPayment).to receive(:new)
          allow(Transactions::Operations::DeleteThisTransaction).to receive(:new)
        end

        it { is_expected.to be_failure }

        it 'returns loan_payment_id not found error' do
          expect(call_operation.failure).to eq(loan_payment_id: 'not found')
        end
      end

      context 'when reverse_account_balance fails' do
        before do
          allow(reverse_balance_operation).to receive(:call).and_return(Failure(account_name: 'failed to update'))
        end

        it { is_expected.to be_failure }

        it 'returns the failure from ReverseAccountBalanceForLoanPayment' do
          expect(call_operation.failure).to include(account_name: 'failed to update')
        end
      end

      context 'when delete_interest_transaction fails' do
        let!(:interest_transaction) do
          create(
            :expense_transaction,
            user: user,
            space: space,
            account: account
          )
        end

        before do
          loan_payment.update!(transaction_id: interest_transaction.id)
          allow(delete_transaction_operation).to receive(:call).and_return(Failure(transaction: ['delete failed']))
        end

        it { is_expected.to be_failure }

        it 'returns the failure from DeleteThisTransaction' do
          expect(call_operation.failure).to include(transaction: ['delete failed'])
        end
      end

      context 'when delete_loan_payment fails' do
        before do
          # Note: This test simulates a destroy! failure
          # In practice, this would be tested with actual database constraints or validations
          allow(loan_payment).to receive(:destroy!).and_raise(StandardError.new('Destroy failed'))
          relation_double = instance_double(ActiveRecord::Relation)
          allow(Transactions::LoanPayment).to receive(:joins).and_return(relation_double)
          allow(relation_double).to receive(:find_by).and_return(loan_payment)
        end

        it { is_expected.to be_failure }

        it 'returns an error' do
          expect(call_operation.failure).to have_key(:error)
        end
      end

      context 'when update_loan fails' do
        before do
          # Mock the loan instance to fail recalculate
          loan_instance = loan_payment.loan
          allow(loan_instance).to receive(:recalculate_outstanding_balance!).and_raise(StandardError.new('Recalculate failed'))
          relation_double = instance_double(ActiveRecord::Relation)
          allow(Transactions::LoanPayment).to receive(:joins).and_return(relation_double)
          allow(relation_double).to receive(:find_by).and_return(loan_payment)
          allow(loan_payment).to receive(:loan).and_return(loan_instance)
        end

        it { is_expected.to be_failure }

        it 'returns an error' do
          expect(call_operation.failure).to have_key(:error)
        end
      end
    end

    describe 'Transaction Rollback' do
      context 'when any step fails after transaction starts' do
        before do
          allow(reverse_balance_operation).to receive(:call).and_return(Failure(error: 'Balance reversal failed'))
        end

        it 'does not delete the loan payment' do
          payment_id = loan_payment.id
          call_operation
          expect(Transactions::LoanPayment.find_by(id: payment_id)).to be_present
        end

        it 'does not change account balance' do
          initial_balance = account.reload.balance
          call_operation
          expect(account.reload.balance).to eq(initial_balance)
        end
      end
    end
  end
end
