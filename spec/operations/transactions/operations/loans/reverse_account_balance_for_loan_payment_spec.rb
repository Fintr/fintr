# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Loans::ReverseAccountBalanceForLoanPayment do
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
      outstanding_balance_cents: 100_000_00,
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
      principal_payment_cents: 7_942_27,
      interest_payment_cents: 849_32,
      total_payment_cents: 8_791_59,
      currency: 'PHP'
    )
  end

  let(:valid_params) do
    {
      loan_payment: loan_payment,
      loan: loan,
      account: account
    }
  end

  describe '#validate' do
    context 'when valid params' do
      it 'returns a successful result' do
        result = operation.send(:validate, params: valid_params)
        expect(result).to be_success
      end

      it 'returns the validated params' do
        result = operation.send(:validate, params: valid_params)
        expect(result.value!).to include(
          loan_payment: loan_payment,
          loan: loan,
          account: account
        )
      end
    end

    context 'when invalid params' do
      it 'returns a failure result when loan_payment is missing' do
        invalid_params = valid_params.except(:loan_payment)
        result = operation.send(:validate, params: invalid_params)
        expect(result).to be_failure
        expect(result.failure[:errors]).to have_key(:loan_payment)
      end

      it 'returns a failure result when loan is missing' do
        invalid_params = valid_params.except(:loan)
        result = operation.send(:validate, params: invalid_params)
        expect(result).to be_failure
        expect(result.failure[:errors]).to have_key(:loan)
      end

      it 'returns a failure result when account is missing' do
        invalid_params = valid_params.except(:account)
        result = operation.send(:validate, params: invalid_params)
        expect(result).to be_failure
        expect(result.failure[:errors]).to have_key(:account)
      end
    end
  end

  describe '#call' do
    context 'when loan type is borrowed' do
      it 'returns a successful result' do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'increases the account balance by the total payment amount' do
        initial_balance = account.reload.balance.amount
        result = operation.call(valid_params)
        expect(result).to be_success

        account.reload
        expected_balance = initial_balance + loan_payment.total_payment.amount
        expect(account.balance.amount).to eq(expected_balance)
      end

      it 'reverses the payment that was subtracted from the account' do
        # Simulate that payment was already subtracted
        account.update!(balance: Money.from_amount(10_000 - 8_791.59, 'PHP'))
        initial_balance = account.reload.balance.amount

        result = operation.call(valid_params)
        expect(result).to be_success

        account.reload
        expect(account.balance.amount).to eq(initial_balance + 8_791.59)
      end

      it 'returns the updated account' do
        result = operation.call(valid_params)
        expect(result.value!).to eq(account)
        expect(result.value!).to be_persisted
      end

      it 'reloads the account before calculating balance' do
        allow(account).to receive(:reload).and_return(account)
        operation.call(valid_params)

        expect(account).to have_received(:reload)
      end
    end

    context 'when loan type is lent' do
      let(:lent_loan) do
        create(
          :loan,
          user: user,
          space: space,
          entity: entity,
          account: account,
          principal_amount_cents: 100_000_00,
          outstanding_balance_cents: 100_000_00,
          interest_rate: 10.0,
          loan_term_months: 12,
          date: Date.new(2024, 1, 1),
          maturity_date: Date.new(2024, 12, 31),
          loan_type: 'lent',
          currency: 'PHP'
        )
      end

      let(:lent_loan_payment) do
        create(
          :loan_payment,
          loan: lent_loan,
          account: account,
          date: Date.new(2024, 2, 1),
          principal_payment_cents: 7_942_27,
          interest_payment_cents: 849_32,
          total_payment_cents: 8_791_59,
          currency: 'PHP'
        )
      end

      let(:lent_params) do
        {
          loan_payment: lent_loan_payment,
          loan: lent_loan,
          account: account
        }
      end

      it 'returns a successful result' do
        result = operation.call(lent_params)
        expect(result).to be_success
      end

      it 'decreases the account balance by the total payment amount' do
        initial_balance = account.reload.balance.amount
        result = operation.call(lent_params)
        expect(result).to be_success

        account.reload
        expected_balance = initial_balance - lent_loan_payment.total_payment.amount
        expect(account.balance.amount).to eq(expected_balance)
      end

      it 'reverses the payment that was added to the account' do
        # Simulate that payment was already added
        account.update!(balance: Money.from_amount(10_000 + 8_791.59, 'PHP'))
        initial_balance = account.reload.balance.amount

        result = operation.call(lent_params)
        expect(result).to be_success

        account.reload
        expect(account.balance.amount).to eq(initial_balance - 8_791.59)
      end
    end

    context 'when account save fails' do
      before do
        allow(account).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(account))
        allow(account).to receive(:errors).and_return(instance_double(ActiveModel::Errors, to_hash: { balance: ['error'] }))
      end

      it 'returns a failure result' do
        result = operation.call(valid_params)
        expect(result).to be_failure
      end

      it 'returns account_name error in the failure' do
        result = operation.call(valid_params)
        expect(result.failure).to have_key(:account_name)
        expect(result.failure[:account_name]).to eq('failed to update')
      end

      it 'includes the error in the failure' do
        result = operation.call(valid_params)
        expect(result.failure).to have_key(:error)
      end
    end

    context 'with different currencies' do
      let(:usd_account) { create(:account, space: space, balance: Money.from_amount(10_000, 'USD'), name: 'USD Account') }
      let(:usd_loan) do
        create(
          :loan,
          user: user,
          space: space,
          entity: entity,
          account: usd_account,
          currency: 'USD'
        )
      end

      let(:usd_loan_payment) do
        create(
          :loan_payment,
          loan: usd_loan,
          account: usd_account,
          total_payment_cents: 8_791_59,
          currency: 'USD'
        )
      end

      let(:usd_params) do
        {
          loan_payment: usd_loan_payment,
          loan: usd_loan,
          account: usd_account
        }
      end

      it 'uses the loan currency for calculations' do
        initial_balance = usd_account.reload.balance.amount
        result = operation.call(usd_params)
        expect(result).to be_success

        usd_account.reload
        expected_balance = initial_balance + usd_loan_payment.total_payment.amount
        expect(usd_account.balance.amount).to eq(expected_balance)
        expect(usd_account.balance_currency).to eq('USD')
      end

      it 'defaults to PHP when loan currency is nil' do
        usd_loan.update!(currency: nil)
        initial_balance = usd_account.reload.balance.amount
        result = operation.call(usd_params)
        expect(result).to be_success

        usd_account.reload
        expect(usd_account.balance_currency).to eq('USD') # Account currency is preserved
      end
    end

    context 'when account balance currency differs from loan currency' do
      let(:usd_account) { create(:account, space: space, balance: Money.from_amount(10_000, 'USD'), name: 'USD Account') }
      let(:php_loan) do
        create(
          :loan,
          user: user,
          space: space,
          entity: entity,
          account: usd_account,
          currency: 'PHP'
        )
      end

      let(:php_loan_payment) do
        create(
          :loan_payment,
          loan: php_loan,
          account: usd_account,
          total_payment_cents: 8_791_59,
          currency: 'PHP'
        )
      end

      let(:mixed_params) do
        {
          loan_payment: php_loan_payment,
          loan: php_loan,
          account: usd_account
        }
      end

      it 'uses account balance currency for the updated balance' do
        initial_balance = usd_account.reload.balance.amount
        result = operation.call(mixed_params)
        expect(result).to be_success

        usd_account.reload
        # Converts PHP amount to USD using account's currency
        expect(usd_account.balance_currency).to eq('USD')
      end
    end
  end
end


