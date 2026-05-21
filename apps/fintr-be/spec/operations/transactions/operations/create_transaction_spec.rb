# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::CreateTransaction do
  include Dry::Monads[:result]
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space: space, balance: Money.from_amount(1000, 'PHP')) }
  let(:income_category) { create(:category, space: space, category_type: 'income', name: 'Salary') }
  let(:expense_category) { create(:category, space: space, category_type: 'expense', name: 'Groceries') }

  describe '#call' do
    context 'with income transaction parameters' do
      subject(:call_operation) { operation.call(income_params) }

      let(:income_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 150.0,
          date: Date.current,
          description: 'Salary payment',
          transaction_type: 'income',
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
        expect(result.balance_state).to eq('calculated')
      end
    end

    context "when original_currency matches account currency (manual rate still sent)" do
      let(:usd_account) do
        create(
          :account,
          space: space,
          name: "USD Cash",
          balance_currency: "USD",
          balance: Money.from_amount(0, "USD")
        )
      end

      let(:usd_income_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 100.0,
          date: Date.current,
          description: "USD deposit",
          transaction_type: "income",
          category_name: income_category.name,
          account_name: usd_account.name,
          schedule_type: "one_time",
          original_currency: "USD",
          exchange_rate: 0.5,
          exchange_rate_source: "manual"
        }
      end

      it "stores the amount as account currency without a currency_conversion row" do
        result = operation.call(usd_income_params)
        expect(result).to be_success
        tx = result.value!
        expect(tx.amount_currency).to eq("USD")
        expect(tx.amount.amount).to eq(100.0)
        expect(tx.currency_conversion).to be_blank
      end
    end

    context "when amount_in_currency matches the account currency while the space currency differs" do
      subject(:call_result) { operation.call(account_currency_amount_params) }

      let(:usd_account) do
        create(
          :account,
          space: space,
          name: "USD Pocket",
          balance_currency: "USD",
          balance: Money.from_amount(100, "USD")
        )
      end

      let(:account_currency_amount_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 25.0,
          date: Date.current,
          description: "Top up",
          transaction_type: "income",
          category_name: income_category.name,
          account_name: usd_account.name,
          schedule_type: "one_time",
          amount_in_currency: "USD"
        }
      end


      it { expect(call_result).to be_success }

      it "persists the amount in the account currency" do
        expect(call_result.value!.amount_currency).to eq("USD")
      end

      it "does not create a currency_conversion row" do
        expect(call_result.value!.currency_conversion).to be_blank
      end

      it "stores the numeric amount without space-currency conversion" do
        expect(call_result.value!.amount.amount).to eq(25.0)
      end

      it "updates the account balance by the amount in account currency" do
        expect { call_result }.to change { usd_account.reload.balance.amount }.by(25.0)
      end
    end

    context "when amount_in_currency is neither the account nor the space currency" do
      let(:usd_account) do
        create(
          :account,
          space: space,
          name: "USD Err",
          balance_currency: "USD",
          balance: Money.from_amount(0, "USD")
        )
      end

      let(:invalid_currency_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 10.0,
          date: Date.current,
          description: "Bad currency hint",
          transaction_type: "income",
          category_name: income_category.name,
          account_name: usd_account.name,
          schedule_type: "one_time",
          amount_in_currency: "EUR"
        }
      end

      it "returns a failure" do
        expect(operation.call(invalid_currency_params)).to be_failure
      end

      it "returns errors for amount_in_currency" do
        result = operation.call(invalid_currency_params)
        expect(result.failure).to include(:amount_in_currency)
      end
    end

    context 'with expense transaction parameters' do
      subject(:call_operation) { operation.call(expense_params) }

      let(:expense_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 75.0,
          date: Date.current,
          description: 'Grocery shopping',
          transaction_type: 'expense',
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

    context 'with draft transaction parameters' do
      subject(:call_operation) { operation.call(draft_params) }

      let(:draft_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 100.0,
          date: Date.current,
          description: 'Draft transaction',
          transaction_type: 'expense',
          category_name: expense_category.name,
          account_name: account.name,
          schedule_type: 'one_time',
          draft: true
        }
      end

      it { is_expected.to be_success }

      it 'creates a draft transaction' do
        expect { call_operation }.to change(Transactions::Draft, :count).by(1)
      end

      it 'does not change the account balance' do
        expect { call_operation }.not_to change { account.reload.balance.amount }
      end

      it 'sets the draft transaction attributes correctly' do
        result = call_operation.value!
        expect(result).to be_a(Transactions::Draft)
        expect(result.amount.amount).to eq(100.0)
        expect(result.date).to eq(Date.current)
        expect(result.description).to eq('Draft transaction')
        expect(result.space_id).to eq(space.id)
        expect(result.account_id).to eq(account.id)
        expect(result.category_id).to eq(expense_category.id)
        expect(result.schedule_type).to eq('one_time')
        expect(result.balance_state).to eq('pending')
      end
    end

    context 'with monthly summary update' do
      subject(:call_operation) { operation.call(income_params) }

      let(:income_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 150.0,
          date: Date.current,
          description: 'Salary payment',
          transaction_type: 'income',
          category_name: income_category.name,
          account_name: account.name,
          schedule_type: 'one_time'
        }
      end

      it 'calls UpdateSummary operation for monthly financial summary' do
        update_summary_operation = instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary)
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Success())

        call_operation

        expect(update_summary_operation).to have_received(:call).with(
          space_id: space.id,
          transaction_date: Date.current
        )
      end
    end

    context 'with file attachment' do
      subject(:call_operation) { operation.call(file_params) }

      let(:file) { fixture_file_upload('test.jpg', 'image/jpeg') }
      let(:file_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 50.0,
          date: Date.current,
          description: 'Transaction with file',
          transaction_type: 'expense',
          category_name: expense_category.name,
          account_name: account.name,
          schedule_type: 'one_time',
          file: file
        }
      end

      it { is_expected.to be_success }

      it 'attaches the file to the transaction' do
        result = call_operation.value!
        expect(result.files).to be_attached
      end
    end

    context 'with file_id attachment' do
      subject(:call_operation) { operation.call(file_id_params) }

      let(:existing_transaction) { create(:expense_transaction, user: user, space: space) }
      let(:file) { fixture_file_upload('test.jpg', 'image/jpeg') }
      let(:existing_attachment) do
        existing_transaction.files.attach(
          io: file,
          filename: 'receipt.jpg',
          content_type: 'image/jpeg'
        )
        existing_transaction.files.first
      end
      let(:file_id_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 50.0,
          date: Date.current,
          description: 'Transaction with file_id',
          transaction_type: 'expense',
          category_name: expense_category.name,
          account_name: account.name,
          schedule_type: 'one_time',
          file_id: existing_attachment.id
        }
      end

      it { is_expected.to be_success }

      it 'attaches the existing blob to the transaction' do
        result = call_operation.value!
        expect(result.files).to be_attached
      end
    end

    context 'with draft removal' do
      subject(:call_operation) { operation.call(draft_removal_params) }

      let(:existing_draft) { create(:draft_transaction, user: user, space: space) }
      let(:draft_removal_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 100.0,
          date: Date.current,
          description: 'Transaction with draft removal',
          transaction_type: 'expense',
          category_name: expense_category.name,
          account_name: account.name,
          schedule_type: 'one_time',
          draft_id: existing_draft.id
        }
      end

      it { is_expected.to be_success }

      it 'removes the existing draft' do
        expect { call_operation }.to change(Transactions::Draft, :count).by(0)
      end

      it 'creates a new transaction' do
        expect { call_operation }.to change(Transactions::Expense, :count).by(1)
      end
    end

    context 'with repeated expense transaction parameters' do
      subject(:call_operation) { operation.call(repeat_expense_params) }

      let(:repeat_expense_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 50.0,
          date: Date.current,
          description: 'Netflix subscription',
          transaction_type: 'expense',
          category_name: expense_category.name,
          account_name: account.name,
          schedule_type: 'repeat',
          repeat_interval: 'every_2_weeks',
          repeat_count: 1
        }
      end

      it { is_expected.to be_success }

      it 'creates a repeat expense transaction and a recurring transaction' do
        expect { call_operation }.to change(Transactions::Expense, :count).by(3)
      end

      it 'sets the repeat transaction attributes correctly' do
        result = call_operation.value!
        expect(result).to be_a(Transactions::Expense)
        expect(result.amount.amount).to eq(50.0)
        expect(result.schedule_type).to eq('repeat')
        expect(result.repeat_interval).to eq('every_2_weeks')
        expect(result.repeat_count).to eq(1)
      end
    end

    context 'with repeated expense transaction parameters and a file' do
      subject(:call_operation) { operation.call(repeat_expense_params_with_file) }

      let(:file) { fixture_file_upload('test.jpg', 'image/jpeg') }
      let(:repeat_expense_params_with_file) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 50.0,
          date: Date.current,
          description: 'Netflix subscription',
          transaction_type: 'expense',
          category_name: expense_category.name,
          account_name: account.name,
          schedule_type: 'repeat',
          repeat_interval: 'every_2_weeks',
          repeat_count: 1,
          file:
        }
      end

      it 'copies the receipt blobs to each generated occurrence after attach' do
        call_operation
        parent = Transactions::Expense.order(created_at: :desc).find_by!(
          description: 'Netflix subscription',
          space_id: space.id
        )
        parent_blob_ids = parent.files.blobs.map(&:id).sort
        expect(parent_blob_ids).not_to be_empty

        parent.children.each do |child|
          expect(child.files).to be_attached
          expect(child.files.blobs.map(&:id).sort).to eq(parent_blob_ids)
        end
      end
    end

    context 'with installment expense transaction parameters' do
      subject(:call_operation) { operation.call(installment_expense_params) }

      let(:installment_expense_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 150.0,
          date: Date.current,
          description: 'Phone payment',
          transaction_type: 'expense',
          category_name: expense_category.name,
          account_name: account.name,
          schedule_type: 'installment',
          installment_period: 12
        }
      end

      it { is_expected.to be_success }

      it 'creates an installment expense transaction' do
        expect { call_operation }.to change(Transactions::Expense, :count).by(2)
      end

      it 'sets the installment transaction attributes correctly' do
        result = call_operation.value!
        expect(result).to be_a(Transactions::Expense)
        expect(result.amount.amount).to eq(150.0 / 12)
        expect(result.schedule_type).to eq('installment')
        expect(result.installment_period).to eq(12)
        expect(result.installment_count).to eq(1)
      end
    end

    context 'when account balance would go negative' do
      subject(:call_operation) { operation.call(large_expense_params) }

      let(:low_balance_account) { create(:account, space: space, balance: Money.from_amount(20, 'PHP')) }

      let(:large_expense_params) do
        {
          user_id: user.id,
          space_id: space.id,
          amount: 100.0,
          date: Date.current,
          description: 'Too expensive item',
          transaction_type: 'expense',
          category_name: expense_category.name,
          account_name: low_balance_account.name,
          schedule_type: 'one_time'
        }
      end

      it { is_expected.to be_success }

      it 'does not create a transaction' do
        expect { call_operation }.to change(Transactions::Expense, :count)
      end

      it 'does still changes the account balance' do
        expect { call_operation }.to change { low_balance_account.reload.balance.amount }
      end
    end

    context 'with invalid parameters' do
      # Missing required field
      context 'when category_name is missing' do
        subject(:call_operation) { operation.call(invalid_params) }

        let(:invalid_params) do
          {
            user_id: user.id,
            space_id: space.id,
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
          expect(result.failure).to include(:category_id)
        end
      end

      context 'when subcategory does not belong to category_id' do
        subject(:call_operation) { operation.call(mismatched_subcategory_params) }

        let!(:parent_category) { create(:category, :expense, space:, name: 'Travel') }
        let!(:other_parent) { create(:category, :expense, space:, name: 'Food') }
        let!(:subcategory) do
          create(:category, :expense, space:, name: 'Flights', parent: parent_category)
        end

        let(:mismatched_subcategory_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.0,
            date: Date.current,
            description: 'Test',
            transaction_type: 'expense',
            category_id: other_parent.id,
            subcategory_id: subcategory.id,
            account_name: account.name,
            schedule_type: 'one_time'
          }
        end

        it { is_expected.to be_failure }

        it 'returns a subcategory assignment error' do
          result = call_operation
          expect(result.failure[:subcategory_id]).to eq(
            'must belong to the selected parent category'
          )
        end
      end

      # Non-existent category
      context 'when category does not exist' do
        subject(:call_operation) { operation.call(nonexistent_category_params) }

        let(:nonexistent_category_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.0,
            date: Date.current,
            description: 'Test',
            transaction_type: 'expense',
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

      # Non-existent account
      context 'when account does not exist' do
        subject(:call_operation) { operation.call(nonexistent_account_params) }

        let(:nonexistent_account_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.0,
            date: Date.current,
            description: 'Test',
            transaction_type: 'income',
            category_name: income_category.name,
            account_name: 'NonExistentAccount',
            schedule_type: 'one_time'
          }
        end

        it { is_expected.to be_failure }

        it 'returns an error about the account' do
          result = call_operation
          expect(result.failure).to include(:account_name)
          expect(result.failure[:account_name]).to eq('not found')
        end
      end

      context 'when account_id is valid (no name lookup)' do
        subject(:call_operation) { operation.call(params_by_account_id) }

        let(:params_by_account_id) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 25.0,
            date: Date.current,
            description: 'By id',
            transaction_type: 'income',
            category_name: income_category.name,
            account_id: account.id,
            schedule_type: 'one_time'
          }
        end

        it { is_expected.to be_success }

        it 'creates the transaction linked to that account' do
          expect(call_operation.value!.account_id).to eq(account.id)
        end
      end

      context 'when account record is passed (priority over id and name)' do
        subject(:call_operation) { operation.call(params_with_account_record) }

        let(:params_with_account_record) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 25.0,
            date: Date.current,
            description: "By account object",
            transaction_type: "income",
            category_name: income_category.name,
            account:,
            schedule_type: "one_time"
          }
        end

        it { is_expected.to be_success }

        it "creates the transaction linked to that account" do
          expect(call_operation.value!.account_id).to eq(account.id)
        end
      end

      context 'when account_id does not exist' do
        subject(:call_operation) { operation.call(bad_account_id_params) }

        let(:bad_account_id_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 25.0,
            date: Date.current,
            description: 'Bad id',
            transaction_type: 'income',
            category_name: income_category.name,
            account_id: SecureRandom.uuid,
            schedule_type: 'one_time'
          }
        end

        it { is_expected.to be_failure }

        it 'returns an error about the account id' do
          result = call_operation
          expect(result.failure).to include(:account_id)
          expect(result.failure[:account_id]).to eq('not found')
        end
      end

      # Schedule type validation
      context 'when schedule_type is invalid' do
        subject(:call_operation) { operation.call(invalid_schedule_params) }

        let(:invalid_schedule_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.0,
            date: Date.current,
            description: 'Test',
            transaction_type: 'income',
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
        subject(:call_operation) { operation.call(invalid_repeat_params) }

        let(:invalid_repeat_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.0,
            date: Date.current,
            description: 'Test recurring payment',
            transaction_type: 'expense',
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
        end
      end

      # Testing repeat_interval validation
      context 'when repeat_interval is invalid' do
        subject(:call_operation) { operation.call(invalid_interval_params) }

        let(:invalid_interval_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.0,
            date: Date.current,
            description: 'Test recurring payment',
            transaction_type: 'expense',
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

      # Testing installment transaction validation
      context 'when installment transaction is missing required fields' do
        subject(:call_operation) { operation.call(invalid_installment_params) }

        let(:invalid_installment_params) do
          {
            user_id: user.id,
            space_id: space.id,
            amount: 100.0,
            date: Date.current,
            description: 'Test installment payment',
            transaction_type: 'expense',
            category_name: expense_category.name,
            account_name: account.name,
            schedule_type: 'installment'
            # Missing installment_period and installment_count
          }
        end

        it { is_expected.to be_failure }

        it 'returns validation errors for missing installment fields' do
          result = call_operation
          expect(result.failure).to include(:installment_period)
        end
      end
    end
  end
end
