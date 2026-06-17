# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Loans::UpdateLoanInterestTransaction do
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
      principal_payment: Money.from_amount(7_942.27, 'PHP'),
      interest_payment: Money.from_amount(849.32, 'PHP'),
      total_payment: Money.from_amount(8_791.59, 'PHP'),
      currency: 'PHP'
    )
  end

  let(:interest_amount) { Money.from_amount(849.32, 'PHP') }

  let(:valid_params) do
    {
      loan_payment: loan_payment,
      loan: loan,
      interest_amount: interest_amount
    }
  end

  describe '#validate' do
    context 'when valid params are provided' do
      it 'returns a successful result' do
        result = operation.send(:validate, params: valid_params)
        expect(result).to be_success
      end

      it 'returns the validated params' do
        result = operation.send(:validate, params: valid_params)
        validated_params = result.value!
        expect(validated_params[:loan_payment]).to eq(loan_payment)
        expect(validated_params[:loan]).to eq(loan)
        expect(validated_params[:interest_amount]).to eq(interest_amount)
      end
    end

    context 'when loan_payment is missing' do
      let(:params_without_loan_payment) do
        valid_params.except(:loan_payment)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_loan_payment)
        expect(result).to be_failure
      end

      it 'returns error with loan_payment key' do
        result = operation.send(:validate, params: params_without_loan_payment)
        expect(result.failure).to have_key(:error)
      end
    end

    context 'when loan is missing' do
      let(:params_without_loan) do
        valid_params.except(:loan)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_loan)
        expect(result).to be_failure
      end

      it 'returns error with loan key' do
        result = operation.send(:validate, params: params_without_loan)
        expect(result.failure).to have_key(:error)
      end
    end

    context 'when interest_amount is missing' do
      let(:params_without_interest_amount) do
        valid_params.except(:interest_amount)
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_without_interest_amount)
        expect(result).to be_failure
      end

      it 'returns error with interest_amount key' do
        result = operation.send(:validate, params: params_without_interest_amount)
        expect(result.failure).to have_key(:error)
      end
    end

    context 'when interest_amount is negative' do
      let(:params_with_negative_interest) do
        valid_params.merge(interest_amount: Money.from_amount(-100, 'PHP'))
      end

      it 'returns a failure result' do
        result = operation.send(:validate, params: params_with_negative_interest)
        expect(result).to be_failure
      end

      it 'returns interest_amount validation error' do
        result = operation.send(:validate, params: params_with_negative_interest)
        expect(result.failure).to have_key(:error)
        error_hash = result.failure[:error]
        expect(error_hash).to have_key(:interest_amount)
        expect(error_hash[:interest_amount]).to include("must be greater than or equal to 0")
      end
    end

    context 'when interest_amount is zero' do
      let(:params_with_zero_interest) do
        valid_params.merge(interest_amount: Money.from_amount(0, 'PHP'))
      end

      it 'returns a successful result' do
        result = operation.send(:validate, params: params_with_zero_interest)
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    before do
      allow(Transactions::Operations::Loans::CreateLoanInterestTransaction).to receive(:new).and_return(
        instance_double(Transactions::Operations::Loans::CreateLoanInterestTransaction, call: Success(nil))
      )
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(
        instance_double(Transactions::Operations::DeleteThisTransaction, call: Success(nil))
      )
      allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_return(
        instance_double(Transactions::Operations::Accounts::UpdateCalculateBalance, call: Success(nil))
      )
    end

    context 'when interest_amount is zero and no transaction exists' do
      let(:params_with_zero_interest) do
        valid_params.merge(interest_amount: Money.from_amount(0, 'PHP'))
      end

      it 'returns a successful result' do
        result = operation.call(params_with_zero_interest)
        expect(result).to be_success
      end

      it 'returns nil' do
        result = operation.call(params_with_zero_interest)
        expect(result.value!).to be_nil
      end
    end

    context 'when interest_amount is zero and transaction exists' do
      let(:interest_transaction) do
        create(
          :expense_transaction,
          user: user,
          space: space,
          account: account,
          amount: Money.from_amount(849.32, 'PHP')
        )
      end
      let(:params_with_zero_interest) do
        valid_params.merge(interest_amount: Money.from_amount(0, 'PHP'))
      end

      before do
        loan_payment.update!(transaction_id: interest_transaction.id)
      end


      it 'returns a successful result' do
        result = operation.call(params_with_zero_interest)
        expect(result).to be_success
      end

      it 'deletes the interest transaction' do
        delete_op = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_op)
        allow(delete_op).to receive(:call).and_return(Success(nil))

        operation.call(params_with_zero_interest)

        expect(Transactions::Operations::DeleteThisTransaction).to have_received(:new)
        expect(delete_op).to have_received(:call).with(
          transaction: interest_transaction
        )
      end
    end

    context 'when interest_amount is positive and no transaction exists' do
      it 'returns a successful result' do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'creates an interest transaction' do
        create_op = instance_double(Transactions::Operations::Loans::CreateLoanInterestTransaction)
        allow(Transactions::Operations::Loans::CreateLoanInterestTransaction).to receive(:new).and_return(create_op)
        allow(create_op).to receive(:call).and_return(Success(nil))

        operation.call(valid_params)
        expect(create_op).to have_received(:call).with(
          loan_payment: loan_payment,
          loan: loan,
          account: account,
          interest_amount: interest_amount,
          balance_state: "calculated"
        )
      end
    end

    context 'when interest_amount is positive and transaction exists' do
      let(:interest_transaction) do
        create(
          :expense_transaction,
          user: user,
          space: space,
          account: account,
          amount: Money.from_amount(800.0, 'PHP'),
          date: loan_payment.date,
          description: "Interest expense from #{entity.full_name}"
        )
      end

      before do
        loan_payment.update!(transaction_id: interest_transaction.id)
      end

      it 'returns a successful result' do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'updates the interest transaction' do
        result = operation.call(valid_params)
        interest_transaction.reload
        expect(interest_transaction.amount.amount).to eq(849.32)
      end

      it 'updates the transaction date' do
        result = operation.call(valid_params)
        interest_transaction.reload
        expect(interest_transaction.date).to eq(loan_payment.date)
      end

      it 'calls UpdateCalculateBalance' do
        update_op = instance_double(Transactions::Operations::Accounts::UpdateCalculateBalance)
        allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_return(update_op)
        allow(update_op).to receive(:call).and_return(Success(nil))

        operation.call(valid_params)
        expect(update_op).to have_received(:call).with(
          transaction: interest_transaction
        )
      end

      context 'when interest transaction already has the same attributes' do
        let(:interest_transaction) do
          create(
            :expense_transaction,
            user: user,
            space: space,
            account: account,
            amount: interest_amount,
            date: loan_payment.date,
            description: "Interest expense from #{entity.full_name}"
          )
        end

        before do
          loan_payment.update!(transaction_id: interest_transaction.id)
          allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_call_original
        end

        it 'returns success without failing on unchanged transaction' do
          result = operation.call(valid_params)

          expect(result).to be_success
        end
      end

      context 'when loan type is borrowed' do
        it 'sets description to interest expense' do
          result = operation.call(valid_params)
          interest_transaction.reload
          expect(interest_transaction.description).to eq("Interest expense from #{entity.full_name}")
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
        let(:lent_params) do
          {
            loan_payment: lent_loan_payment,
            loan: lent_loan,
            interest_amount: interest_amount
          }
        end

        let(:lent_loan_payment) do
          create(
            :loan_payment,
            loan: lent_loan,
            account: account,
            date: Date.new(2024, 2, 1),
            principal_payment: Money.from_amount(7_942.27, 'PHP'),
            interest_payment: Money.from_amount(849.32, 'PHP'),
            total_payment: Money.from_amount(8_791.59, 'PHP'),
            currency: 'PHP'
          )
        end

        let(:lent_interest_transaction) do
          create(
            :income_transaction,
            user: user,
            space: space,
            account: account,
            amount: Money.from_amount(800.0, 'PHP'),
            date: lent_loan_payment.date
          )
        end

        before do
          lent_loan_payment.update!(transaction_id: lent_interest_transaction.id)
        end


        it 'sets description to interest income' do
          result = operation.call(lent_params)
          lent_interest_transaction.reload
          expect(lent_interest_transaction.description).to eq("Interest income from #{entity.full_name}")
        end
      end

      context 'when update fails' do
        before do
          allow_any_instance_of(Transactions::Transaction).to receive(:save!).and_raise(ActiveRecord::ActiveRecordError.new("Database error"))
        end

        it 'returns a failure result' do
          result = operation.call(valid_params)
          expect(result).to be_failure
        end

        it 'includes error in the failure' do
          result = operation.call(valid_params)
          expect(result.failure).to have_key(:error)
        end
      end
    end
  end

  describe '#find_interest_transaction' do
    context 'when transaction_record exists' do
      let(:interest_transaction) do
        create(
          :expense_transaction,
          user: user,
          space: space,
          account: account,
          amount: Money.from_amount(849.32, 'PHP')
        )
      end

      before do
        loan_payment.update!(transaction_id: interest_transaction.id)
      end

      it 'returns the transaction_record' do
        result = operation.send(:find_interest_transaction, loan_payment: loan_payment)
        expect(result.value!).to eq(interest_transaction)
      end

      it 'returns a successful result' do
        result = operation.send(:find_interest_transaction, loan_payment: loan_payment)
        expect(result).to be_success
      end
    end

    context 'when transaction_record does not exist' do
      it 'returns nil' do
        result = operation.send(:find_interest_transaction, loan_payment: loan_payment)
        expect(result.value!).to be_nil
      end

      it 'returns a successful result' do
        result = operation.send(:find_interest_transaction, loan_payment: loan_payment)
        expect(result).to be_success
      end
    end
  end

  describe '#determine_action' do
    context 'when interest_amount is zero and transaction exists' do
      let(:interest_transaction) do
        create(
          :expense_transaction,
          user: user,
          space: space,
          account: account,
          amount: Money.from_amount(849.32, 'PHP')
        )
      end

      it 'returns :delete action' do
        result = operation.send(
          :determine_action,
          interest_amount: Money.from_amount(0, 'PHP'),
          interest_transaction: interest_transaction
        )
        expect(result.value!).to eq(:delete)
      end
    end

    context 'when interest_amount is zero and transaction does not exist' do
      it 'returns :none action' do
        result = operation.send(
          :determine_action,
          interest_amount: Money.from_amount(0, 'PHP'),
          interest_transaction: nil
        )
        expect(result.value!).to eq(:none)
      end
    end

    context 'when interest_amount is positive and transaction does not exist' do
      it 'returns :create action' do
        result = operation.send(
          :determine_action,
          interest_amount: interest_amount,
          interest_transaction: nil
        )
        expect(result.value!).to eq(:create)
      end
    end

    context 'when interest_amount is positive and transaction exists' do
      let(:interest_transaction) do
        create(
          :expense_transaction,
          user: user,
          space: space,
          account: account,
          amount: Money.from_amount(849.32, 'PHP')
        )
      end

      it 'returns :update action' do
        result = operation.send(
          :determine_action,
          interest_amount: interest_amount,
          interest_transaction: interest_transaction
        )
        expect(result.value!).to eq(:update)
      end
    end
  end

  describe '#execute_action' do
    before do
      allow(Transactions::Operations::Loans::CreateLoanInterestTransaction).to receive(:new).and_return(
        instance_double(Transactions::Operations::Loans::CreateLoanInterestTransaction, call: Success(nil))
      )
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(
        instance_double(Transactions::Operations::DeleteThisTransaction, call: Success(nil))
      )
      allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_return(
        instance_double(Transactions::Operations::Accounts::UpdateCalculateBalance, call: Success(nil))
      )
    end

    context 'when action is :delete' do
      let(:interest_transaction) do
        create(
          :expense_transaction,
          user: user,
          space: space,
          account: account,
          amount: Money.from_amount(849.32, 'PHP')
        )
      end

      it 'calls delete_interest_transaction' do
        delete_op = instance_double(Transactions::Operations::DeleteThisTransaction)
        allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_op)
        allow(delete_op).to receive(:call).and_return(Success(nil))

        operation.send(
          :execute_action,
          action: :delete,
          interest_transaction: interest_transaction,
          loan_payment: loan_payment,
          loan: loan,
          interest_amount: Money.from_amount(0, 'PHP')
        )

        expect(delete_op).to have_received(:call).with(
          transaction: interest_transaction
        )
      end
    end

    context 'when action is :create' do
      it 'calls create_interest_transaction' do
        create_op = instance_double(Transactions::Operations::Loans::CreateLoanInterestTransaction)
        allow(Transactions::Operations::Loans::CreateLoanInterestTransaction).to receive(:new).and_return(create_op)
        allow(create_op).to receive(:call).and_return(Success(nil))

        operation.send(
          :execute_action,
          action: :create,
          interest_transaction: nil,
          loan_payment: loan_payment,
          loan: loan,
          interest_amount: interest_amount
        )

        expect(create_op).to have_received(:call).with(
          loan_payment: loan_payment,
          loan: loan,
          account: account,
          interest_amount: interest_amount,
          balance_state: "calculated"
        )
      end
    end

    context 'when action is :update' do
      let(:interest_transaction) do
        create(
          :expense_transaction,
          user: user,
          space: space,
          account: account,
          amount: Money.from_amount(800.0, 'PHP'),
          date: loan_payment.date
        )
      end

      it 'updates the interest transaction' do
        result = operation.send(
          :execute_action,
          action: :update,
          interest_transaction: interest_transaction,
          loan_payment: loan_payment,
          loan: loan,
          interest_amount: interest_amount
        )

        expect(result).to be_success
        interest_transaction.reload
        expect(interest_transaction.amount.amount).to eq(849.32)
      end

      it 'calls UpdateCalculateBalance' do
        update_op = instance_double(Transactions::Operations::Accounts::UpdateCalculateBalance)
        allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_return(update_op)
        allow(update_op).to receive(:call).and_return(Success(nil))

        operation.send(
          :execute_action,
          action: :update,
          interest_transaction: interest_transaction,
          loan_payment: loan_payment,
          loan: loan,
          interest_amount: interest_amount
        )

        expect(update_op).to have_received(:call).with(
          transaction: interest_transaction
        )
      end
    end

    context 'when action is :none' do
      it 'returns Success(nil)' do
        result = operation.send(
          :execute_action,
          action: :none,
          interest_transaction: nil,
          loan_payment: loan_payment,
          loan: loan,
          interest_amount: Money.from_amount(0, 'PHP')
        )

        expect(result).to be_success
        expect(result.value!).to be_nil
      end
    end
  end

  describe '#create_interest_transaction' do
    it 'calls CreateLoanInterestTransaction with correct params' do
      create_op = instance_double(Transactions::Operations::Loans::CreateLoanInterestTransaction)
      allow(Transactions::Operations::Loans::CreateLoanInterestTransaction).to receive(:new).and_return(create_op)
      allow(create_op).to receive(:call).and_return(Success(nil))

      operation.send(
        :create_interest_transaction,
        loan_payment: loan_payment,
        loan: loan,
        interest_amount: interest_amount
      )

      expect(create_op).to have_received(:call).with(
        loan_payment: loan_payment,
        loan: loan,
        account: account,
        interest_amount: interest_amount,
        balance_state: "calculated"
      )
    end
  end

  describe '#update_interest_transaction' do
    let(:interest_transaction) do
      create(
        :expense_transaction,
        user: user,
        space: space,
        account: account,
        amount: Money.from_amount(800.0, 'PHP'),
        date: loan_payment.date,
        description: "Old description"
      )
    end

    before do
      allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_return(
        instance_double(Transactions::Operations::Accounts::UpdateCalculateBalance, call: Success(nil))
      )
    end

    it 'updates the transaction amount' do
      result = operation.send(
        :update_interest_transaction,
        interest_transaction: interest_transaction,
        loan: loan,
        loan_payment: loan_payment,
        interest_amount: interest_amount
      )

      expect(result).to be_success
      interest_transaction.reload
      expect(interest_transaction.amount.amount).to eq(849.32)
    end

    it 'updates the transaction date' do
      new_date = Date.new(2024, 3, 1)
      loan_payment.update!(date: new_date)

      result = operation.send(
        :update_interest_transaction,
        interest_transaction: interest_transaction,
        loan: loan,
        loan_payment: loan_payment,
        interest_amount: interest_amount
      )

      expect(result).to be_success
      interest_transaction.reload
      expect(interest_transaction.date).to eq(new_date)
    end

    it 'updates the transaction description for borrowed loan' do
      result = operation.send(
        :update_interest_transaction,
        interest_transaction: interest_transaction,
        loan: loan,
        loan_payment: loan_payment,
        interest_amount: interest_amount
      )

      expect(result).to be_success
      interest_transaction.reload
      expect(interest_transaction.description).to eq("Interest expense from #{entity.full_name}")
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

      it 'updates the transaction description to interest income' do
        result = operation.send(
          :update_interest_transaction,
          interest_transaction: interest_transaction,
          loan: lent_loan,
          loan_payment: loan_payment,
          interest_amount: interest_amount
        )

        expect(result).to be_success
        interest_transaction.reload
        expect(interest_transaction.description).to eq("Interest income from #{entity.full_name}")
      end
    end

    it 'updates the transaction account_id' do
      new_account = create(:account, space: space, name: 'New Account')
      loan_payment.update!(account: new_account)

      result = operation.send(
        :update_interest_transaction,
        interest_transaction: interest_transaction,
        loan: loan,
        loan_payment: loan_payment,
        interest_amount: interest_amount
      )

      expect(result).to be_success
      interest_transaction.reload
      expect(interest_transaction.account_id).to eq(new_account.id)
    end

    it 'updates the transaction currency' do
      loan_payment.update!(currency: 'USD')

      result = operation.send(
        :update_interest_transaction,
        interest_transaction: interest_transaction,
        loan: loan,
        loan_payment: loan_payment,
        interest_amount: interest_amount
      )

      expect(result).to be_success
      interest_transaction.reload
      expect(interest_transaction.amount_currency).to eq('USD')
    end

    it 'calls UpdateCalculateBalance' do
      update_op = instance_double(Transactions::Operations::Accounts::UpdateCalculateBalance)
      allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_return(update_op)
      allow(update_op).to receive(:call).and_return(Success(nil))

      operation.send(
        :update_interest_transaction,
        interest_transaction: interest_transaction,
        loan: loan,
        loan_payment: loan_payment,
        interest_amount: interest_amount
      )

      expect(update_op).to have_received(:call).with(
        transaction: interest_transaction
      )
    end

    context 'when update fails' do
      before do
        allow(interest_transaction).to receive(:save!).and_raise(ActiveRecord::ActiveRecordError.new("Database error"))
      end

      it 'returns a failure result' do
        result = operation.send(
          :update_interest_transaction,
          interest_transaction: interest_transaction,
          loan: loan,
          loan_payment: loan_payment,
          interest_amount: interest_amount
        )

        expect(result).to be_failure
      end

      it 'includes error in the failure' do
        result = operation.send(
          :update_interest_transaction,
          interest_transaction: interest_transaction,
          loan: loan,
          loan_payment: loan_payment,
          interest_amount: interest_amount
        )

        expect(result.failure).to have_key(:error)
      end
    end
  end

  describe '#delete_interest_transaction' do
    let(:interest_transaction) do
      create(
        :expense_transaction,
        user: user,
        space: space,
        account: account,
        amount: Money.from_amount(849.32, 'PHP')
      )
    end

    it 'calls DeleteThisTransaction with the transaction' do
      delete_op = instance_double(Transactions::Operations::DeleteThisTransaction)
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_op)
      allow(delete_op).to receive(:call).and_return(Success(nil))

      operation.send(:delete_interest_transaction, interest_transaction: interest_transaction)

      expect(delete_op).to have_received(:call).with(
        transaction: interest_transaction
      )
    end

    it 'returns the result from DeleteThisTransaction' do
      delete_op = instance_double(Transactions::Operations::DeleteThisTransaction)
      allow(Transactions::Operations::DeleteThisTransaction).to receive(:new).and_return(delete_op)
      allow(delete_op).to receive(:call).and_return(Success(nil))

      result = operation.send(:delete_interest_transaction, interest_transaction: interest_transaction)

      expect(result).to be_success
    end
  end
end
