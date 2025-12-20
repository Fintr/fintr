# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Loans::DeleteLoan do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:account) { create(:account, space: space, balance: Money.from_amount(10_000, 'PHP'), name: 'Test Account') }
  let(:entity) { create(:entity, space: space, entity_type: 'loan', full_name: 'Test Lender') }

  let!(:borrowed_loan) do
    create(
      :loan,
      user: user,
      space: space,
      entity: entity,
      account: account,
      principal_amount_cents: 100_000_00, # 100,000 PHP
      outstanding_balance_cents: 100_000_00,
      interest_rate: 10.0,
      loan_term_months: 12,
      date: Date.new(2024, 1, 1),
      maturity_date: Date.new(2024, 12, 31),
      loan_type: 'borrowed',
      currency: 'PHP'
    )
  end

  let!(:lent_loan) do
    create(
      :loan,
      user: user,
      space: space,
      entity: entity,
      account: account,
      principal_amount_cents: 50_000_00, # 50,000 PHP
      outstanding_balance_cents: 50_000_00,
      interest_rate: 8.0,
      loan_term_months: 6,
      date: Date.new(2024, 1, 1),
      maturity_date: Date.new(2024, 6, 30),
      loan_type: 'lent',
      currency: 'PHP'
    )
  end

  let(:valid_params) do
    {
      user_id: user.id.to_s,
      space_id: space.id.to_s,
      loan_id: borrowed_loan.id.to_s
    }
  end

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when user_id is missing' do
        params = valid_params.dup
        params.delete(:user_id)
        result = operation.validate(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:user_id)
      end

      it 'fails when space_id is missing' do
        params = valid_params.dup
        params.delete(:space_id)
        result = operation.validate(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:space_id)
      end

      it 'fails when loan_id is missing' do
        params = valid_params.dup
        params.delete(:loan_id)
        result = operation.validate(params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:loan_id)
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation' do
        result = operation.validate(params: valid_params)
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    context 'when validation fails' do
      it 'returns validation failure for missing loan_id' do
        params = valid_params.dup
        params.delete(:loan_id)
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:loan_id)
      end
    end

    context 'when loan is not found' do
      it 'fails with loan_id not found error' do
        params = valid_params.merge(loan_id: SecureRandom.uuid)
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:loan_id)
        expect(result.failure[:loan_id]).to eq('not found')
      end

      it 'fails when loan exists but space_id does not match' do
        other_space = create(:personal_space)
        loan_in_other_space = create(:loan, space: other_space, user: user, entity: entity, account: account)
        params = valid_params.merge(loan_id: loan_in_other_space.id.to_s)
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:loan_id)
        expect(result.failure[:loan_id]).to eq('not found')
      end
    end

    context 'with valid parameters and no loan payments' do
      context 'with borrowed loan' do
        subject(:call_operation) { operation.call(valid_params) }

        before do
          # Set initial balance to account for the loan's initial impact
          # When a borrowed loan is created, it increases the account balance
          # So we need to account for that
          account.update(balance: Money.from_amount(110_000, 'PHP'))
        end

        it 'is successful' do
          expect(call_operation).to be_success
        end

        it 'returns the deleted loan' do
          result = call_operation.value!
          expect(result).to be_a(Transactions::Loan)
          expect(result.id).to eq(borrowed_loan.id)
        end

        it 'deletes the loan' do
          expect { call_operation }.to change(Transactions::Loan, :count).by(-1)
        end

        it 'reverses the initial account balance for borrowed loan' do
          initial_balance = account.reload.balance.amount
          call_operation
          final_balance = account.reload.balance.amount
          # Reversal should decrease balance by 100,000 (negative of principal)
          expect(final_balance).to eq(initial_balance - 100_000)
        end

        it 'decreases account balance by principal amount for borrowed loan' do
          initial_balance = account.reload.balance.amount
          call_operation
          final_balance = account.reload.balance.amount
          expected_balance = initial_balance - borrowed_loan.principal_amount.amount
          expect(final_balance).to eq(expected_balance)
        end
      end

      context 'with lent loan' do
        subject(:call_operation) { operation.call(valid_params.merge(loan_id: lent_loan.id.to_s)) }

        before do
          # Set initial balance to account for the loan's initial impact
          # When a lent loan is created, it decreases the account balance
          # So we need to account for that
          account.update(balance: Money.from_amount(60_000, 'PHP'))
        end

        it 'is successful' do
          expect(call_operation).to be_success
        end

        it 'returns the deleted loan' do
          result = call_operation.value!
          expect(result).to be_a(Transactions::Loan)
          expect(result.id).to eq(lent_loan.id)
        end

        it 'deletes the loan' do
          expect { call_operation }.to change(Transactions::Loan, :count).by(-1)
        end

        it 'reverses the initial account balance for lent loan' do
          initial_balance = account.reload.balance.amount
          call_operation
          final_balance = account.reload.balance.amount
          # Reversal should increase balance by 50,000 (positive of principal)
          expect(final_balance).to eq(initial_balance + 50_000)
        end

        it 'increases account balance by principal amount for lent loan' do
          initial_balance = account.reload.balance.amount
          call_operation
          final_balance = account.reload.balance.amount
          expected_balance = initial_balance + lent_loan.principal_amount.amount
          expect(final_balance).to eq(expected_balance)
        end
      end
    end

    context 'with loan payments' do
      subject(:call_operation) { operation.call(valid_params) }

      let(:delete_loan_payment_operation) { instance_double(Transactions::Operations::Loans::DeleteLoanPayment) }
      let!(:loan_payment1) { create(:loan_payment, loan: borrowed_loan, account: account) }
      let!(:loan_payment2) { create(:loan_payment, loan: borrowed_loan, account: account) }

      before do
        allow(Transactions::Operations::Loans::DeleteLoanPayment).to receive(:new).and_return(delete_loan_payment_operation)
        allow(delete_loan_payment_operation).to receive(:call).and_return(Success(loan_payment1))
      end


      it 'calls DeleteLoanPayment for each payment' do
        call_operation
        expect(delete_loan_payment_operation).to have_received(:call).twice
      end

      it 'passes correct parameters to DeleteLoanPayment' do
        expected_params1 = {
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          loan_payment_id: loan_payment1.id.to_s
        }
        expected_params2 = {
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          loan_payment_id: loan_payment2.id.to_s
        }
        call_operation
        expect(delete_loan_payment_operation).to have_received(:call).with(expected_params1)
        expect(delete_loan_payment_operation).to have_received(:call).with(expected_params2)
      end

      it 'orders loan payments by date' do
        loan_payment1.update(date: Date.new(2024, 3, 1))
        loan_payment2.update(date: Date.new(2024, 2, 1))
        call_operation
        # Should be called in date order (payment2 first, then payment1)
        expect(delete_loan_payment_operation).to have_received(:call).with(
          hash_including(loan_payment_id: loan_payment2.id.to_s)
        ).ordered
        expect(delete_loan_payment_operation).to have_received(:call).with(
          hash_including(loan_payment_id: loan_payment1.id.to_s)
        ).ordered
      end

      context 'when DeleteLoanPayment fails' do
        before do
          allow(delete_loan_payment_operation).to receive(:call).and_return(
            Failure(loan_payment_id: 'failed to delete')
          )
        end

        it 'returns failure from DeleteLoanPayment' do
          result = call_operation
          expect(result).to be_failure
          expect(result.failure).to have_key(:loan_payment_id)
          expect(result.failure[:loan_payment_id]).to eq('failed to delete')
        end

        it 'does not delete the loan when payment deletion fails' do
          expect { call_operation }.not_to change(Transactions::Loan, :count)
        end
      end
    end

    context 'with account balance errors' do
      context 'when account update fails' do
        before do
          # Create a scenario where save! would fail by making account invalid
          # However, since we're testing error handling in a transaction,
          # and the actual error depends on database constraints, we'll test
          # that the error handling mechanism exists but skip complex mocking
          # that would require allow_any_instance_of
          allow(Transactions::Loan).to receive(:find_by).and_return(borrowed_loan)
          account_instance = borrowed_loan.account
          allow(borrowed_loan).to receive(:account).and_return(account_instance)
          allow(account_instance).to receive(:reload).and_return(account_instance)
          allow(account_instance).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(account_instance))
        end

        it 'fails with account update error' do
          result = operation.call(valid_params)
          expect(result).to be_failure
          expect(result.failure).to have_key(:account_name)
          expect(result.failure[:account_name]).to eq('failed to update')
        end

        it 'does not delete the loan when account update fails' do
          expect { operation.call(valid_params) }.not_to change(Transactions::Loan, :count)
        end
      end
    end

    context 'when loan deletion fails' do
      before do
        allow(borrowed_loan).to receive(:destroy!).and_raise(StandardError.new('Deletion failed'))
        allow(Transactions::Loan).to receive(:find_by).and_return(borrowed_loan)
      end

      it 'fails with deletion error' do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:error)
        expect(result.failure[:error]).to eq('Deletion failed')
      end
    end

    context 'with multiple loan payments deletion order' do
      subject(:call_operation) { operation.call(valid_params) }

      let(:delete_loan_payment_operation) { instance_double(Transactions::Operations::Loans::DeleteLoanPayment) }
      let!(:payment1) do
        create(:loan_payment, loan: borrowed_loan, account: account, date: Date.new(2024, 2, 1))
      end
      let!(:payment2) do
        create(:loan_payment, loan: borrowed_loan, account: account, date: Date.new(2024, 1, 15))
      end
      let!(:payment3) do
        create(:loan_payment, loan: borrowed_loan, account: account, date: Date.new(2024, 3, 1))
      end

      before do
        allow(Transactions::Operations::Loans::DeleteLoanPayment).to receive(:new).and_return(delete_loan_payment_operation)
        allow(delete_loan_payment_operation).to receive(:call).and_return(Success(nil))
      end


      it 'deletes payments in chronological order' do
        call_operation
        # Payments should be deleted in date order: payment2 (Jan 15), payment1 (Feb 1), payment3 (Mar 1)
        expect(delete_loan_payment_operation).to have_received(:call).with(
          hash_including(loan_payment_id: payment2.id.to_s)
        ).ordered
        expect(delete_loan_payment_operation).to have_received(:call).with(
          hash_including(loan_payment_id: payment1.id.to_s)
        ).ordered
        expect(delete_loan_payment_operation).to have_received(:call).with(
          hash_including(loan_payment_id: payment3.id.to_s)
        ).ordered
      end
    end
  end
end
