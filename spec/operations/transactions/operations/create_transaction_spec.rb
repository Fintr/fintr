# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::CreateTransaction do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:account) { create(:account, space: space, balance: Money.from_amount(1000, 'PHP')) }
  let(:income_category) { create(:category, space: space, category_type: 'income', name: 'Salary') }
  let(:expense_category) { create(:category, space: space, category_type: 'expense', name: 'Groceries') }

  describe '#call' do
    context 'with income transaction parameters' do
      subject(:call_operation) { operation.call(params: income_params) }

      let(:income_params) do
        {
          user_id: user.id,
          space_code: space.code,
          amount: 150.0,
          date: Date.current,
          description: 'Salary payment',
          category_name: income_category.name,
          account_name: account.name,
          schedule_type: 'one_time'
        }
      end


      it { is_expected.to be_success }

      it 'creates an income transaction' do
        expect { call_operation }.to change(Transactions::Income, :count).by(1)
      end

      it 'increases the account balance' do
        expect { call_operation }.to change { account.reload.balance.amount }.by(150.0)
      end

      it 'sets the transaction attributes correctly' do
        result = call_operation.value!
        expect(result).to be_a(Transactions::Income)
        expect(result.amount.amount).to eq(150.0)
        expect(result.date).to eq(Date.current)
        expect(result.description).to eq('Salary payment')
        expect(result.space_id).to eq(space.id)
        expect(result.account_id).to eq(account.id)
        expect(result.category_id).to eq(income_category.id)
        expect(result.schedule_type).to eq('one_time')
      end
    end

    context 'with expense transaction parameters' do
      subject(:call_operation) { operation.call(params: expense_params) }

      let(:expense_params) do
        {
          user_id: user.id,
          space_code: space.code,
          amount: 75.0,
          date: Date.current,
          description: 'Grocery shopping',
          category_name: expense_category.name,
          account_name: account.name,
          schedule_type: 'one_time'
        }
      end


      it { is_expected.to be_success }

      it 'creates an expense transaction' do
        expect { call_operation }.to change(Transactions::Expense, :count).by(1)
      end

      it 'decreases the account balance' do
        expect { call_operation }.to change { account.reload.balance.amount }.by(-75.0)
      end

      it 'sets the transaction attributes correctly' do
        result = call_operation.value!
        expect(result).to be_a(Transactions::Expense)
        expect(result.amount.amount).to eq(75.0)
        expect(result.date).to eq(Date.current)
        expect(result.description).to eq('Grocery shopping')
        expect(result.space_id).to eq(space.id)
        expect(result.account_id).to eq(account.id)
        expect(result.category_id).to eq(expense_category.id)
        expect(result.schedule_type).to eq('one_time')
      end
    end

    context 'with repeated expense transaction parameters' do
      subject(:call_operation) { operation.call(params: repeat_expense_params) }

      let(:repeat_expense_params) do
        {
          space_code: space.code,
          amount: 50.0,
          date: Date.current,
          description: 'Netflix subscription',
          category_name: expense_category.name,
          account_name: account.name,
          schedule_type: 'repeat',
          repeat_interval: 'every_month',
          repeat_count: 12
        }
      end


      it { is_expected.to be_success }

      it 'creates a repeat expense transaction' do
        expect { call_operation }.to change(Transactions::Expense, :count).by(1)
      end

      it 'sets the repeat transaction attributes correctly' do
        result = call_operation.value!
        expect(result).to be_a(Transactions::Expense)
        expect(result.amount.amount).to eq(50.0)
        expect(result.schedule_type).to eq('repeat')
        expect(result.repeat_interval).to eq('every_month')
        expect(result.repeat_count).to eq(12)
      end
    end

    context 'when account balance would go negative' do
      subject(:call_operation) { operation.call(params: large_expense_params) }

      let(:low_balance_account) { create(:account, space: space, balance: Money.from_amount(20, 'PHP')) }

      let(:large_expense_params) do
        {
          user_id: user.id,
          space_code: space.code,
          amount: 100.0,
          date: Date.current,
          description: 'Too expensive item',
          category_name: expense_category.name,
          account_name: low_balance_account.name,
          schedule_type: 'one_time'
        }
      end


      it { is_expected.to be_failure }

      it 'does not create a transaction' do
        expect { call_operation }.not_to change(Transactions::Expense, :count)
      end

      it 'does not change the account balance' do
        expect { call_operation }.not_to change { low_balance_account.reload.balance.amount }
      end

      it 'returns an error about negative balance' do
        result = call_operation
        expect(result.failure).to include(:account_name)
        expect(result.failure[:account_name]).to include("Balance cannot be negative")
      end
    end

    context 'with invalid parameters' do
      # Missing required field
      context 'when category_name is missing' do
        subject(:call_operation) { operation.call(params: invalid_params) }

        let(:invalid_params) do
          {
            user_id: user.id,
            space_code: space.code,
            amount: 100.0,
            date: Date.current,
            description: 'Test',
            account_name: account.name,
            schedule_type: 'one_time'
            # Missing category_name
          }
        end


        it { is_expected.to be_failure }

        it 'returns validation errors' do
          result = call_operation
          expect(result.failure).to include(:category_name)
        end
      end

      # Non-existent category
      context 'when category does not exist' do
        subject(:call_operation) { operation.call(params: nonexistent_category_params) }

        let(:nonexistent_category_params) do
          {
            user_id: user.id,
            space_code: space.code,
            amount: 100.0,
            date: Date.current,
            description: 'Test',
            category_name: 'NonExistentCategory',
            account_name: account.name,
            schedule_type: 'one_time'
          }
        end


        it { is_expected.to be_failure }

        it 'returns an error about the category' do
          result = call_operation
          expect(result.failure).to include(:category_name)
          expect(result.failure[:category_name]).to eq('not found')
        end
      end

      # Non-existent space
      context 'when space does not exist' do
        subject(:call_operation) { operation.call(params: nonexistent_space_params) }

        let(:nonexistent_space_params) do
          {
            user_id: user.id,
            space_code: 'non-existent-space',
            amount: 100.0,
            date: Date.current,
            description: 'Test',
            category_name: income_category.name,
            account_name: account.name,
            schedule_type: 'one_time'
          }
        end


        it { is_expected.to be_failure }

        it 'returns an error about the space' do
          result = call_operation
          expect(result.failure).to include(:space_code)
          expect(result.failure[:space_code]).to eq('not found')
        end
      end

      # Schedule type validation
      context 'when schedule_type is invalid' do
        subject(:call_operation) { operation.call(params: invalid_schedule_params) }

        let(:invalid_schedule_params) do
          {
            user_id: user.id,
            space_code: space.code,
            amount: 100.0,
            date: Date.current,
            description: 'Test',
            category_name: income_category.name,
            account_name: account.name,
            schedule_type: 'invalid_type'
          }
        end


        it { is_expected.to be_failure }

        it 'returns an error about the schedule type' do
          result = call_operation
          expect(result.failure).to include(:schedule_type)
          expect(result.failure[:schedule_type].first).to include('must be one of')
        end
      end

      # Repeat transaction validations
      context 'when repeat transaction is missing required fields' do
        subject(:call_operation) { operation.call(params: invalid_repeat_params) }

        let(:invalid_repeat_params) do
          {
            user_id: user.id,
            space_code: space.code,
            amount: 100.0,
            date: Date.current,
            description: 'Test recurring payment',
            category_name: expense_category.name,
            account_name: account.name,
            schedule_type: 'repeat'
            # Missing repeat_interval and repeat_count
          }
        end


        it { is_expected.to be_failure }

        it 'returns validation errors for missing repeat fields' do
          result = call_operation
          expect(result.failure).to include(:repeat_interval)
          expect(result.failure).to include(:repeat_count)
        end
      end

      # Testing repeat_interval validation
      context 'when repeat_interval is invalid' do
        subject(:call_operation) { operation.call(params: invalid_interval_params) }

        let(:invalid_interval_params) do
          {
            user_id: user.id,
            space_code: space.code,
            amount: 100.0,
            date: Date.current,
            description: 'Test recurring payment',
            category_name: expense_category.name,
            account_name: account.name,
            schedule_type: 'repeat',
            repeat_interval: 'invalid_interval', # Invalid interval
            repeat_count: 3
          }
        end


        it { is_expected.to be_failure }

        it 'returns validation errors for invalid repeat_interval' do
          result = call_operation
          expect(result.failure).to include(:repeat_interval)
          expect(result.failure[:repeat_interval]).to include('must be a valid interval')
        end
      end
    end
  end
end
