# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Loans::UpdateLoanPayment do
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

      context 'with optional params' do
        let(:params_with_optional) do
          {
            user_id: user.id.to_s,
            space_id: space.id.to_s,
            loan_payment_id: loan_payment.id.to_s,
            account_name: account.name,
            date: Date.new(2024, 3, 1),
            total_payment: 9_000.0,
            principal_payment: 8_000.0,
            notes: 'Updated payment'
          }
        end

        it 'returns a successful result' do
          result = operation.validate(params: params_with_optional)
          expect(result).to be_success
        end

        it 'returns the validated params including optional ones' do
          result = operation.validate(params: params_with_optional)
          expect(result.value!).to eq(params_with_optional)
        end
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

      it 'returns a failure result when total_payment is zero' do
        invalid_params = valid_params.merge(total_payment: 0)
        result = operation.validate(params: invalid_params)
        expect(result).to be_failure
      end

      it 'returns a failure result when total_payment is negative' do
        invalid_params = valid_params.merge(total_payment: -100)
        result = operation.validate(params: invalid_params)
        expect(result).to be_failure
      end

      it 'returns a failure result when principal_payment is negative' do
        invalid_params = valid_params.merge(principal_payment: -100)
        result = operation.validate(params: invalid_params)
        expect(result).to be_failure
      end
    end
  end

  describe '#call' do
    subject(:call_operation) { operation.call(params) }

    let(:params) { valid_params }
    let(:calculate_interest_operation) { instance_double(Transactions::Operations::Loans::CalculateLoanPaymentInterest) }
    let(:update_account_balance_operation) { instance_double(Transactions::Operations::Loans::UpdateAccountBalanceForLoanPayment) }
    let(:update_interest_transaction_operation) { instance_double(Transactions::Operations::Loans::UpdateLoanInterestTransaction) }

    before do
      allow(Transactions::Operations::Loans::CalculateLoanPaymentInterest).to receive(:new).and_return(calculate_interest_operation)
      allow(calculate_interest_operation).to receive(:call).and_return(Success(Money.from_amount(849.32, 'PHP')))
      allow(Transactions::Operations::Loans::UpdateAccountBalanceForLoanPayment).to receive(:new).and_return(update_account_balance_operation)
      allow(update_account_balance_operation).to receive(:call).and_return(Success(account))
      allow(Transactions::Operations::Loans::UpdateLoanInterestTransaction).to receive(:new).and_return(update_interest_transaction_operation)
      allow(update_interest_transaction_operation).to receive(:call).and_return(Success(nil))
    end

    context 'with valid parameters' do
      it { is_expected.to be_success }

      it 'returns the updated loan payment' do
        result = call_operation.value!
        expect(result).to be_a(Transactions::LoanPayment)
        expect(result.id).to eq(loan_payment.id)
      end

      context 'when updating total_payment' do
        let(:params) { valid_params.merge(total_payment: 9_000.0) }

        it { is_expected.to be_success }

        it 'updates the total payment amount' do
          result = call_operation.value!
          expect(result.total_payment.amount).to eq(9_000.0)
        end

        it 'recalculates interest and principal' do
          result = call_operation.value!
          expect(result.interest_payment).to be_present
          expect(result.principal_payment).to be_present
        end
      end

      context 'when updating date' do
        let(:params) { valid_params.merge(date: Date.new(2024, 3, 1)) }

        it { is_expected.to be_success }

        it 'updates the payment date' do
          result = call_operation.value!
          expect(result.date).to eq(Date.new(2024, 3, 1))
        end

        it 'recalculates interest for the new date' do
          call_operation
          expect(calculate_interest_operation).to have_received(:call).with(
            loan: loan,
            payment_date: Date.new(2024, 3, 1),
            exclude_payment_id: loan_payment.id
          )
        end
      end

      context 'when updating account_name' do
        let(:new_account) { create(:account, space: space, balance: Money.from_amount(5_000, 'PHP'), name: 'New Account') }
        let(:params) { valid_params.merge(account_name: new_account.name) }

        it { is_expected.to be_success }

        it 'updates the account' do
          result = call_operation.value!
          expect(result.account_id).to eq(new_account.id)
        end

        it 'calls UpdateAccountBalanceForLoanPayment with correct parameters' do
          call_operation
          expect(update_account_balance_operation).to have_received(:call).with(
            loan_payment: loan_payment,
            loan: loan,
            account: new_account
          )
        end
      end

      context 'when updating notes' do
        let(:params) { valid_params.merge(notes: 'Updated payment notes') }

        it { is_expected.to be_success }

        it 'updates the notes' do
          result = call_operation.value!
          expect(result.notes).to eq('Updated payment notes')
        end
      end

      context 'when updating multiple fields' do
        let(:new_account) { create(:account, space: space, balance: Money.from_amount(5_000, 'PHP'), name: 'New Account') }
        let(:params) do
          valid_params.merge(
            account_name: new_account.name,
            date: Date.new(2024, 3, 1),
            total_payment: 9_500.0,
            notes: 'Multiple updates'
          )
        end

        it { is_expected.to be_success }

        it 'updates all specified fields' do
          result = call_operation.value!
          expect(result.account_id).to eq(new_account.id)
          expect(result.date).to eq(Date.new(2024, 3, 1))
          expect(result.total_payment.amount).to eq(9_500.0)
          expect(result.notes).to eq('Multiple updates')
        end
      end

      it 'calls CalculateLoanPaymentInterest with correct parameters' do
        call_operation
        expect(Transactions::Operations::Loans::CalculateLoanPaymentInterest).to have_received(:new)
        expect(calculate_interest_operation).to have_received(:call).with(
          loan: loan,
          payment_date: loan_payment.date,
          exclude_payment_id: loan_payment.id
        )
      end

      it 'calls UpdateAccountBalanceForLoanPayment with correct parameters' do
        call_operation
        expect(update_account_balance_operation).to have_received(:call).with(
          loan_payment: loan_payment,
          loan: loan,
          account: account
        )
      end

      it 'calls UpdateLoanInterestTransaction' do
        call_operation
        expect(update_interest_transaction_operation).to have_received(:call).with(
          loan_payment: loan_payment,
          loan: loan,
          interest_amount: loan_payment.interest_payment
        )
      end

      it 'recalculates the loan outstanding balance' do
        initial_outstanding = loan.reload.outstanding_balance
        call_operation
        loan.reload
        # Balance should change after payment update
        expect(loan.outstanding_balance).not_to eq(initial_outstanding)
      end
    end

    describe 'Validation Failures' do
      context 'when user_id is missing' do
        let(:params) { { space_id: space.id.to_s, loan_payment_id: loan_payment.id.to_s } }

        before do
          allow(Transactions::Operations::Loans::CalculateLoanPaymentInterest).to receive(:new)
          allow(Transactions::Operations::Loans::UpdateAccountBalanceForLoanPayment).to receive(:new)
          allow(Transactions::Operations::Loans::UpdateLoanInterestTransaction).to receive(:new)
        end

        it { is_expected.to be_failure }

        it 'returns user_id missing error' do
          expect(call_operation.failure).to include(user_id: ['is missing'])
        end
      end

      context 'when space_id is missing' do
        let(:params) { { user_id: user.id.to_s, loan_payment_id: loan_payment.id.to_s } }

        before do
          allow(Transactions::Operations::Loans::CalculateLoanPaymentInterest).to receive(:new)
          allow(Transactions::Operations::Loans::UpdateAccountBalanceForLoanPayment).to receive(:new)
          allow(Transactions::Operations::Loans::UpdateLoanInterestTransaction).to receive(:new)
        end

        it { is_expected.to be_failure }

        it 'returns space_id missing error' do
          expect(call_operation.failure).to include(space_id: ['is missing'])
        end
      end

      context 'when loan_payment_id is missing' do
        let(:params) { { user_id: user.id.to_s, space_id: space.id.to_s } }

        before do
          allow(Transactions::Operations::Loans::CalculateLoanPaymentInterest).to receive(:new)
          allow(Transactions::Operations::Loans::UpdateAccountBalanceForLoanPayment).to receive(:new)
          allow(Transactions::Operations::Loans::UpdateLoanInterestTransaction).to receive(:new)
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
          allow(Transactions::Operations::Loans::CalculateLoanPaymentInterest).to receive(:new)
          allow(Transactions::Operations::Loans::UpdateAccountBalanceForLoanPayment).to receive(:new)
          allow(Transactions::Operations::Loans::UpdateLoanInterestTransaction).to receive(:new)
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
          allow(Transactions::Operations::Loans::CalculateLoanPaymentInterest).to receive(:new)
          allow(Transactions::Operations::Loans::UpdateAccountBalanceForLoanPayment).to receive(:new)
          allow(Transactions::Operations::Loans::UpdateLoanInterestTransaction).to receive(:new)
        end

        it { is_expected.to be_failure }

        it 'returns loan_payment_id not found error' do
          expect(call_operation.failure).to eq(loan_payment_id: 'not found')
        end
      end

      context 'when account_name is provided but account not found' do
        let(:params) { valid_params.merge(account_name: 'Non-existent Account') }

        before do
          allow(calculate_interest_operation).to receive(:call).and_return(Success(Money.from_amount(849.32, 'PHP')))
        end

        it { is_expected.to be_failure }

        it 'returns account_name not found error' do
          expect(call_operation.failure).to eq(account_name: 'not found')
        end
      end

      context 'when calculate_interest fails' do
        before do
          allow(calculate_interest_operation).to receive(:call).and_return(Failure(error: 'Interest calculation failed'))
        end

        it { is_expected.to be_failure }

        it 'returns the failure from CalculateLoanPaymentInterest' do
          expect(call_operation.failure).to include(error: 'Interest calculation failed')
        end
      end

      context 'when update_account_balance fails' do
        before do
          allow(update_account_balance_operation).to receive(:call).and_return(Failure(account_name: 'failed to update'))
        end

        it { is_expected.to be_failure }

        it 'returns the failure from UpdateAccountBalanceForLoanPayment' do
          expect(call_operation.failure).to include(account_name: 'failed to update')
        end
      end

      context 'when save_loan_payment fails' do
        before do
          relation_double = instance_double(ActiveRecord::Relation)
          allow(Transactions::LoanPayment).to receive(:joins).and_return(relation_double)
          allow(relation_double).to receive(:find_by).and_return(loan_payment)
          allow(loan_payment).to receive(:save!).and_raise(ActiveRecord::ActiveRecordError.new('Save failed'))
        end

        it { is_expected.to be_failure }

        it 'returns the error message' do
          expect(call_operation.failure).to have_key(:error)
        end
      end

      context 'when process_loan_payment fails' do
        before do
          relation_double = instance_double(ActiveRecord::Relation)
          allow(Transactions::LoanPayment).to receive(:joins).and_return(relation_double)
          allow(relation_double).to receive(:find_by).and_return(loan_payment)
          allow(loan_payment).to receive(:process_payment).and_raise(ActiveRecord::ActiveRecordError.new('Process failed'))
        end

        it { is_expected.to be_failure }

        it 'returns the error message' do
          expect(call_operation.failure).to have_key(:error)
        end
      end

      context 'when update_interest_transaction fails' do
        before do
          allow(update_interest_transaction_operation).to receive(:call).and_return(Failure(error: 'Transaction update failed'))
        end

        it { is_expected.to be_failure }

        it 'returns the failure from UpdateLoanInterestTransaction' do
          expect(call_operation.failure).to include(error: 'Transaction update failed')
        end
      end

      context 'when update_loan fails' do
        before do
          loan_instance = loan_payment.loan
          relation_double = instance_double(ActiveRecord::Relation)
          allow(Transactions::LoanPayment).to receive(:joins).and_return(relation_double)
          allow(relation_double).to receive(:find_by).and_return(loan_payment)
          allow(loan_payment).to receive(:loan).and_return(loan_instance)
          allow(loan_instance).to receive(:recalculate_outstanding_balance!).and_raise(ActiveRecord::ActiveRecordError.new('Recalculate failed'))
        end

        it { is_expected.to be_failure }

        it 'returns the error message' do
          expect(call_operation.failure).to have_key(:error)
        end
      end
    end

    describe 'Transaction Rollback' do
      context 'when any step fails after transaction starts' do
        before do
          allow(update_account_balance_operation).to receive(:call).and_return(Failure(error: 'Balance update failed'))
        end

        it 'does not update the loan payment' do
          original_date = loan_payment.date
          original_total = loan_payment.total_payment
          call_operation
          loan_payment.reload
          expect(loan_payment.date).to eq(original_date)
          expect(loan_payment.total_payment).to eq(original_total)
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
