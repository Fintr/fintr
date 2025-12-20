# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Loans::CreateLoanInterestTransaction do
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

  let(:interest_amount) { Money.from_amount(849.32, 'PHP') }
  let(:balance_state) { 'calculated' }

  let(:valid_params) do
    {
      loan_payment: loan_payment,
      loan: loan,
      account: account,
      interest_amount: interest_amount,
      balance_state: balance_state
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
          account: account,
          interest_amount: interest_amount,
          balance_state: balance_state
        )
      end
    end

    context 'when invalid params' do
      it 'returns a failure result when loan_payment is missing' do
        invalid_params = valid_params.except(:loan_payment)
        result = operation.send(:validate, params: invalid_params)
        expect(result).to be_failure
        expect(result.failure[:error]).to have_key(:loan_payment)
      end

      it 'returns a failure result when loan is missing' do
        invalid_params = valid_params.except(:loan)
        result = operation.send(:validate, params: invalid_params)
        expect(result).to be_failure
        expect(result.failure[:error]).to have_key(:loan)
      end

      it 'returns a failure result when account is missing' do
        invalid_params = valid_params.except(:account)
        result = operation.send(:validate, params: invalid_params)
        expect(result).to be_failure
        expect(result.failure[:error]).to have_key(:account)
      end

      it 'returns a failure result when interest_amount is missing' do
        invalid_params = valid_params.except(:interest_amount)
        result = operation.send(:validate, params: invalid_params)
        expect(result).to be_failure
        expect(result.failure[:error]).to have_key(:interest_amount)
      end

      it 'returns a failure result when balance_state is missing' do
        invalid_params = valid_params.except(:balance_state)
        result = operation.send(:validate, params: invalid_params)
        expect(result).to be_failure
        expect(result.failure[:error]).to have_key(:balance_state)
      end

      it 'returns a failure result when interest_amount is negative' do
        invalid_params = valid_params.merge(interest_amount: Money.from_amount(-100, 'PHP'))
        result = operation.send(:validate, params: invalid_params)
        expect(result).to be_failure
        expect(result.failure[:error]).to have_key(:interest_amount)
        expect(result.failure[:error][:interest_amount]).to include('must be greater than or equal to 0')
      end

      it 'returns a failure result when balance_state is invalid' do
        invalid_params = valid_params.merge(balance_state: 'invalid_state')
        result = operation.send(:validate, params: invalid_params)
        expect(result).to be_failure
        expect(result.failure[:error]).to have_key(:balance_state)
      end
    end
  end

  describe '#call' do
    context 'when interest_amount is zero' do
      let(:zero_interest_params) { valid_params.merge(interest_amount: Money.from_amount(0, 'PHP')) }

      it 'returns Success without creating a transaction' do
        result = operation.call(zero_interest_params)
        expect(result).to be_success
        # Dry::Operation wraps the return value, so we check that value! returns nil
        if result.value!.respond_to?(:value!)
          expect(result.value!.value!).to be_nil
        else
          expect(result.value!).to be_nil
        end
      end

      it 'does not create a transaction' do
        expect { operation.call(zero_interest_params) }.not_to change(Transactions::Transaction, :count)
      end

      it 'does not call FindOrCreateInterestCategory' do
        find_category_operation = instance_double(Transactions::Operations::Loans::FindOrCreateInterestCategory)
        allow(find_category_operation).to receive(:call)
        allow(Transactions::Operations::Loans::FindOrCreateInterestCategory).to receive(:new).and_return(find_category_operation)

        operation.call(zero_interest_params)

        expect(find_category_operation).not_to have_received(:call)
      end
    end

    context 'with valid parameters' do
      let(:find_category_operation) { instance_double(Transactions::Operations::Loans::FindOrCreateInterestCategory) }
      let(:create_transaction_operation) { instance_double(Transactions::Operations::CreateTransaction) }
      let(:category) { create(:category, space: space, name: 'Interest Expense', category_type: 'expense') }
      let(:interest_transaction) { create(:transaction, user: user, space: space, account: account, category: category, amount: Money.from_amount(849.32, 'PHP')) }

      before do
        allow(Transactions::Operations::Loans::FindOrCreateInterestCategory).to receive(:new).and_return(find_category_operation)
        allow(find_category_operation).to receive(:call).and_return(Success(category))

        allow(Transactions::Operations::CreateTransaction).to receive(:new).and_return(create_transaction_operation)
        allow(create_transaction_operation).to receive(:call).and_return(Success(interest_transaction))
      end

      it 'returns a successful result' do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'creates an interest transaction' do
        result = operation.call(valid_params)
        expect(result.value!).to be_a(Transactions::Transaction)
      end

      it 'calls FindOrCreateInterestCategory with correct params' do
        operation.call(valid_params)

        expect(find_category_operation).to have_received(:call).with(
          space_id: space.id.to_s,
          loan_type: 'borrowed'
        )
      end

      it 'calls CreateTransaction with correct params' do
        operation.call(valid_params)

        expect(create_transaction_operation).to have_received(:call) do |params|
          expect(params[:user_id]).to eq(user.id.to_s)
          expect(params[:space_id]).to eq(space.id.to_s)
          expect(params[:amount]).to eq(849.32)
          expect(params[:date]).to eq(loan_payment.date)
          expect(params[:category_name]).to eq('Interest Expense')
          expect(params[:account_name]).to eq(account.name)
          expect(params[:description]).to include('Interest expense from')
          expect(params[:description]).to include(entity.full_name)
          expect(params[:schedule_type]).to eq('one_time')
          expect(params[:skip_calculation]).to be true
        end
      end

      it 'links the transaction to the loan_payment' do
        result = operation.call(valid_params)
        loan_payment.reload

        expect(loan_payment.transaction_id).to eq(interest_transaction.id)
      end

      context 'when loan_type is lent' do
        let(:lent_loan) do
          create(
            :loan,
            user: user,
            space: space,
            entity: entity,
            account: account,
            loan_type: 'lent',
            currency: 'PHP'
          )
        end

        let(:lent_params) { valid_params.merge(loan: lent_loan) }

        it 'creates Interest Income category' do
          income_category = create(:category, space: space, name: 'Interest Income', category_type: 'income')
          allow(find_category_operation).to receive(:call).and_return(Success(income_category))

          operation.call(lent_params)

          expect(find_category_operation).to have_received(:call).with(
            space_id: space.id.to_s,
            loan_type: 'lent'
          )
        end

        it 'prepares description with income wording' do
          income_category = create(:category, space: space, name: 'Interest Income', category_type: 'income')
          allow(find_category_operation).to receive(:call).and_return(Success(income_category))

          operation.call(lent_params)

          expect(create_transaction_operation).to have_received(:call) do |params|
            expect(params[:description]).to include('Interest income from')
            expect(params[:description]).to include(entity.full_name)
          end
        end
      end

      context 'when balance_state is pending' do
        let(:pending_params) { valid_params.merge(balance_state: 'pending') }

        it 'sets skip_calculation to false' do
          operation.call(pending_params)

          expect(create_transaction_operation).to have_received(:call) do |params|
            expect(params[:skip_calculation]).to be false
          end
        end
      end
    end

    context 'when currency needs to be updated' do
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
          currency: 'USD'
        )
      end

      let(:usd_params) do
        {
          loan_payment: usd_loan_payment,
          loan: usd_loan,
          account: usd_account,
          interest_amount: Money.from_amount(849.32, 'USD'),
          balance_state: 'calculated'
        }
      end

      let(:category) { create(:category, space: space, name: 'Interest Expense', category_type: 'expense') }
      let(:interest_transaction) do
        create(
          :transaction,
          user: user,
          space: space,
          account: usd_account,
          category: category,
          amount: Money.from_amount(849.32, 'PHP'),
          amount_currency: 'PHP'
        )
      end

      let(:find_category_operation) { instance_double(Transactions::Operations::Loans::FindOrCreateInterestCategory) }
      let(:create_transaction_operation) { instance_double(Transactions::Operations::CreateTransaction) }

      before do
        allow(Transactions::Operations::Loans::FindOrCreateInterestCategory).to receive(:new).and_return(find_category_operation)
        allow(find_category_operation).to receive(:call).and_return(Success(category))

        allow(Transactions::Operations::CreateTransaction).to receive(:new).and_return(create_transaction_operation)
        allow(create_transaction_operation).to receive(:call).and_return(Success(interest_transaction))
      end

      it 'updates transaction currency to match loan_payment currency' do
        result = operation.call(usd_params)
        interest_transaction.reload

        expect(interest_transaction.amount_currency).to eq('USD')
        expect(interest_transaction.balance_currency).to eq('USD')
      end

      it 'uses loan currency when loan_payment currency matches loan currency' do
        # Currency is already set to USD for both, but this tests the logic path
        result = operation.call(usd_params)
        interest_transaction.reload

        expect(interest_transaction.amount_currency).to eq('USD')
      end

      context 'when loan_payment has different currency than loan' do
        let(:eur_loan_payment) do
          create(
            :loan_payment,
            loan: usd_loan,
            account: usd_account,
            currency: 'EUR'
          )
        end

        let(:eur_params) do
          {
            loan_payment: eur_loan_payment,
            loan: usd_loan,
            account: usd_account,
            interest_amount: Money.from_amount(849.32, 'EUR'),
            balance_state: 'calculated'
          }
        end

        it 'uses loan_payment currency' do
          result = operation.call(eur_params)
          interest_transaction.reload

          expect(interest_transaction.amount_currency).to eq('EUR')
          expect(interest_transaction.balance_currency).to eq('EUR')
        end
      end

      it 'does not update currency if already correct' do
        interest_transaction.update!(amount_currency: 'USD', balance_currency: 'USD')

        result = operation.call(usd_params)
        interest_transaction.reload

        expect(interest_transaction.amount_currency).to eq('USD')
        expect(interest_transaction.balance_currency).to eq('USD')
      end
    end

    context 'when FindOrCreateInterestCategory fails' do
      let(:find_category_operation) { instance_double(Transactions::Operations::Loans::FindOrCreateInterestCategory) }

      before do
        allow(Transactions::Operations::Loans::FindOrCreateInterestCategory).to receive(:new).and_return(find_category_operation)
        allow(find_category_operation).to receive(:call).and_return(Failure(category: 'could not create Interest Expense category'))
      end

      it 'returns a failure result' do
        result = operation.call(valid_params)
        expect(result).to be_failure
      end

      it 'does not create a transaction' do
        expect { operation.call(valid_params) }.not_to change(Transactions::Transaction, :count)
      end
    end

    context 'when CreateTransaction fails' do
      let(:find_category_operation) { instance_double(Transactions::Operations::Loans::FindOrCreateInterestCategory) }
      let(:create_transaction_operation) { instance_double(Transactions::Operations::CreateTransaction) }
      let(:category) { create(:category, space: space, name: 'Interest Expense', category_type: 'expense') }

      before do
        allow(Transactions::Operations::Loans::FindOrCreateInterestCategory).to receive(:new).and_return(find_category_operation)
        allow(find_category_operation).to receive(:call).and_return(Success(category))

        allow(Transactions::Operations::CreateTransaction).to receive(:new).and_return(create_transaction_operation)
        allow(create_transaction_operation).to receive(:call).and_return(Failure(account_name: 'not found'))
      end

      it 'returns a failure result' do
        result = operation.call(valid_params)
        expect(result).to be_failure
      end

      it 'does not link transaction to loan_payment' do
        operation.call(valid_params)
        loan_payment.reload

        expect(loan_payment.transaction_id).to be_nil
      end
    end

    context 'when linking transaction fails' do
      let(:find_category_operation) { instance_double(Transactions::Operations::Loans::FindOrCreateInterestCategory) }
      let(:create_transaction_operation) { instance_double(Transactions::Operations::CreateTransaction) }
      let(:category) { create(:category, space: space, name: 'Interest Expense', category_type: 'expense') }
      let(:interest_transaction) { create(:transaction, user: user, space: space, account: account, category: category) }

      before do
        allow(Transactions::Operations::Loans::FindOrCreateInterestCategory).to receive(:new).and_return(find_category_operation)
        allow(find_category_operation).to receive(:call).and_return(Success(category))

        allow(Transactions::Operations::CreateTransaction).to receive(:new).and_return(create_transaction_operation)
        allow(create_transaction_operation).to receive(:call).and_return(Success(interest_transaction))

        allow(loan_payment).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(loan_payment))
      end

      it 'returns a failure result' do
        result = operation.call(valid_params)
        expect(result).to be_failure
      end
    end
  end
end
