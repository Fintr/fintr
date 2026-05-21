# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Accounts::AdjustAccountBalance do
  include Dry::Monads[:result]
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space: space, balance: Money.from_amount(1000, 'PHP')) }
  let(:adjustment_date) { Date.current.to_s }

  describe '#call' do
    context 'with valid parameters for positive adjustment' do
      subject(:call_operation) { operation.call(positive_adjustment_params) }

      let(:positive_adjustment_params) do
        {
          user_id: user.id,
          space_id: space.id,
          id: account.id,
          new_balance: 1500.0,
          adjustment_date: adjustment_date
        }
      end

      it { is_expected.to be_success }

      it 'creates an income adjustment transaction' do
        expect { call_operation }.to change(Transactions::Income, :count).by(1)
      end

      it 'adjusts the account balance correctly' do
        expect { call_operation }.to change { account.reload.balance.amount }.by(500.0)
      end

      it 'creates the adjustment transaction with correct attributes' do
        result = call_operation.value!
        expect(result).to be_a(Transactions::Income)
        expect(result.amount.amount).to eq(500.0)
        expect(result.date).to eq(Date.current)
        expect(result.description).to eq('Balance adjustment')
        expect(result.space_id).to eq(space.id)
        expect(result.account_id).to eq(account.id)
      end

      it 'uses Income Adjustment category' do
        result = call_operation.value!
        expect(result.category.name).to eq('Income Adjustment')
        expect(result.category.category_type).to eq('income')
      end
    end

    context 'with valid parameters for negative adjustment' do
      subject(:call_operation) { operation.call(negative_adjustment_params) }

      let(:negative_adjustment_params) do
        {
          user_id: user.id,
          space_id: space.id,
          id: account.id,
          new_balance: 700.0,
          adjustment_date: adjustment_date
        }
      end

      it { is_expected.to be_success }

      it 'creates an expense adjustment transaction' do
        expect { call_operation }.to change(Transactions::Expense, :count).by(1)
      end

      it 'adjusts the account balance correctly' do
        expect { call_operation }.to change { account.reload.balance.amount }.by(-300.0)
      end

      it 'creates the adjustment transaction with correct attributes' do
        result = call_operation.value!
        expect(result).to be_a(Transactions::Expense)
        expect(result.amount.amount).to eq(300.0)
        expect(result.date).to eq(Date.current)
        expect(result.description).to eq('Balance adjustment')
        expect(result.space_id).to eq(space.id)
        expect(result.account_id).to eq(account.id)
      end

      it 'uses Expense Adjustment category' do
        result = call_operation.value!
        expect(result.category.name).to eq('Expense Adjustment')
        expect(result.category.category_type).to eq('expense')
      end
    end

    context 'when account currency differs from space currency' do
      subject(:call_result) { operation.call(cross_currency_params) }

      let(:space) { create(:personal_space, currency: 'PHP') }
      let(:usd_account) do
        create(
          :account,
          space: space,
          name: 'USD Wallet',
          balance: Money.from_amount(1000, 'USD'),
          balance_currency: 'USD'
        )
      end
      let(:cross_currency_params) do
        {
          user_id: user.id,
          space_id: space.id,
          id: usd_account.id,
          new_balance: 1500.0,
          adjustment_date: adjustment_date
        }
      end


      it { expect(call_result).to be_success }

      it 'persists the adjustment amount in the account currency' do
        expect(call_result.value!.amount_currency).to eq('USD')
      end

      it 'persists the raw delta without treating it as space currency' do
        expect(call_result.value!.amount.amount).to eq(500.0)
      end

      it 'updates the account balance to the requested amount' do
        call_result
        expect(usd_account.reload.balance.amount).to eq(1500.0)
      end

      it 'does not create a currency_conversion row on the adjustment transaction' do
        expect(call_result.value!.currency_conversion).to be_blank
      end

      context 'when a PHP exchange rate exists for the adjustment date' do
        subject(:call_result) { operation.call(cross_currency_params) }

        let(:usd_account) do
          create(
            :account,
            space: space,
            name: 'USD Wallet FX',
            balance: Money.from_amount(1000, 'USD'),
            balance_currency: 'USD'
          )
        end
        let(:cross_currency_params) do
          {
            user_id: user.id,
            space_id: space.id,
            id: usd_account.id,
            new_balance: 1100.0,
            adjustment_date: adjustment_date
          }
        end

        before do
          ExchangeRates::ApiExchangeRate.create!(
            base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
            target_currency: 'PHP',
            rate: 58,
            rate_date: Date.current
          )
        end


        it { expect(call_result).to be_success }

        it 'books the delta in USD on the transaction' do
          expect(call_result.value!.amount.amount).to eq(100.0)
        end

        it 'sets transaction amount_currency to USD' do
          expect(call_result.value!.amount_currency).to eq('USD')
        end

        it 'exposes amount_in_space_currency in the space currency using FX' do
          payload = call_result.value!.amount_in_space_currency
          expect(payload[:currency]).to eq('PHP')
        end

        it 'converts the booked USD delta to PHP for space-context display' do
          payload = call_result.value!.amount_in_space_currency
          expect(payload[:amount]).to eq(5800.0)
        end
      end
    end

    context 'with custom adjustment date' do
      subject(:call_operation) { operation.call(custom_date_params) }

      let(:custom_date) { '2024-01-15' }
      let(:custom_date_params) do
        {
          user_id: user.id,
          space_id: space.id,
          id: account.id,
          new_balance: 1200.0,
          adjustment_date: custom_date
        }
      end

      it { is_expected.to be_success }

      it 'creates the transaction with the specified date' do
        result = call_operation.value!
        expect(result.date).to eq(Date.parse(custom_date))
      end
    end

    context 'with validation errors' do
      context 'when user_id is missing' do
        subject(:call_operation) { operation.call(params_missing_user_id) }

        let(:params_missing_user_id) do
          {
            space_id: space.id,
            id: account.id,
            new_balance: 1500.0,
            adjustment_date: adjustment_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with user_id missing error' do
          expect(call_operation.failure).to eq({ user_id: ['is missing'] })
        end
      end

      context 'when space_id is missing' do
        subject(:call_operation) { operation.call(params_missing_space_id) }

        let(:params_missing_space_id) do
          {
            user_id: user.id,
            id: account.id,
            new_balance: 1500.0,
            adjustment_date: adjustment_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with space_id missing error' do
          expect(call_operation.failure).to eq({ space_id: ['is missing'] })
        end
      end

      context 'when id is missing' do
        subject(:call_operation) { operation.call(params_missing_id) }

        let(:params_missing_id) do
          {
            user_id: user.id,
            space_id: space.id,
            new_balance: 1500.0,
            adjustment_date: adjustment_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with id missing error' do
          expect(call_operation.failure).to eq({ id: ['is missing'] })
        end
      end

      context 'when new_balance is missing' do
        subject(:call_operation) { operation.call(params_missing_new_balance) }

        let(:params_missing_new_balance) do
          {
            user_id: user.id,
            space_id: space.id,
            id: account.id,
            adjustment_date: adjustment_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with new_balance missing error' do
          expect(call_operation.failure).to eq({ new_balance: ['is missing'] })
        end
      end

      context 'when adjustment_date is missing' do
        subject(:call_operation) { operation.call(params_missing_adjustment_date) }

        let(:params_missing_adjustment_date) do
          {
            user_id: user.id,
            space_id: space.id,
            id: account.id,
            new_balance: 1500.0
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with adjustment_date missing error' do
          expect(call_operation.failure).to eq({ adjustment_date: ['is missing'] })
        end
      end

      context 'when adjustment_date has invalid format' do
        let(:params_invalid_date) do
          {
            user_id: user.id,
            space_id: space.id,
            id: account.id,
            new_balance: 1500.0,
            adjustment_date: 'invalid-date'
          }
        end

        it 'raises Date::Error because Date.parse does not handle invalid format gracefully' do
          expect { operation.call(params_invalid_date) }.to raise_error(Date::Error)
        end
      end

      context 'when new_balance is not a decimal' do
        subject(:call_operation) { operation.call(params_invalid_new_balance) }

        let(:params_invalid_new_balance) do
          {
            user_id: user.id,
            space_id: space.id,
            id: account.id,
            new_balance: 'not_a_number',
            adjustment_date: adjustment_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with new_balance type error' do
          expect(call_operation.failure).to include(:new_balance)
        end
      end
    end

    context 'when user is not found' do
      subject(:call_operation) { operation.call(params_with_invalid_user) }

      let(:params_with_invalid_user) do
        {
          user_id: 'non-existent-user-id',
          space_id: space.id,
          id: account.id,
          new_balance: 1500.0,
          adjustment_date: adjustment_date
        }
      end

      it { is_expected.to be_failure }

      it 'returns a failure with user not found error' do
        expect(call_operation.failure).to eq({ user: 'not found' })
      end
    end

    context 'when account is not found' do
      subject(:call_operation) { operation.call(params_with_invalid_account) }

      let(:params_with_invalid_account) do
        {
          user_id: user.id,
          space_id: space.id,
          id: 'non-existent-account-id',
          new_balance: 1500.0,
          adjustment_date: adjustment_date
        }
      end

      it { is_expected.to be_failure }

      it 'returns a failure with account not found error' do
        expect(call_operation.failure).to eq({ account: 'not found' })
      end
    end

    context 'when category creation fails' do
      subject(:call_operation) { operation.call(valid_params) }

      let(:valid_params) do
        {
          user_id: user.id,
          space_id: space.id,
          id: account.id,
          new_balance: 1500.0,
          adjustment_date: adjustment_date
        }
      end

      before do
        allow(Transactions::Category).to receive(:find_or_create_by!).and_raise(
          ActiveRecord::RecordInvalid.new(Transactions::Category.new)
        )
      end

      it { is_expected.to be_failure }

      it 'returns a failure with category creation error' do
        result = call_operation
        expect(result.failure).to include(:category)
        expect(result.failure[:category]).to include('could not create')
      end
    end

    context 'when transaction creation fails' do
      subject(:call_operation) { operation.call(valid_params) }

      let(:valid_params) do
        {
          user_id: user.id,
          space_id: space.id,
          id: account.id,
          new_balance: 1500.0,
          adjustment_date: adjustment_date
        }
      end

      before do
        create_transaction_operation = instance_double(Transactions::Operations::CreateTransaction)
        allow(Transactions::Operations::CreateTransaction).to receive(:new).and_return(create_transaction_operation)
        allow(create_transaction_operation).to receive(:call).and_return(
          Failure({ category_name: 'not found' })
        )
      end

      it { is_expected.to be_failure }

      it 'returns a failure with transaction creation error' do
        result = call_operation
        expect(result.failure).to include(:transaction)
        expect(result.failure[:transaction]).to eq('could not create adjustment transaction')
      end
    end
  end
end
