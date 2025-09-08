# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::UpdateTransaction, type: :operation do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space) }
  let!(:space_user) { create(:space_user, user:, space:) }
  let!(:account) { create(:account, space:) }
  let!(:category) { create(:category, name: 'Food', space:) }
  let!(:new_category) { create(:category, name: 'Entertainment', space:) }

  describe '#call' do
    context 'with a one-time transaction' do
      let!(:transaction) do
        create(
          :expense_transaction,
          :one_time,
          user:,
          space:,
          account:,
          category:,
          amount: 100.00,
          description: 'Original description'
        )
      end

      it 'updates the transaction successfully' do
        result = described_class.new.call(
          id: transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 150.00,
          date: transaction.date.to_date,
          category_name: new_category.name,
          account_name: account.name,
          description: 'Updated description',
          schedule_type: 'one_time'
        )

        expect(result).to be_success

        updated_transaction = result.value!
        expect(updated_transaction.amount.amount).to eq(150.00)
        expect(updated_transaction.description).to eq('Updated description')
        expect(updated_transaction.category).to eq(new_category)
      end
    end

    context 'with a recurring transaction' do
      let!(:parent_transaction) do
        create(
          :expense_transaction,
          :repeat,
          user:,
          space:,
          account:,
          category:,
          amount: 100.00,
          description: 'Monthly expense',
          date: Date.current
        )
      end

      let!(:child_transaction) do
        create(
          :expense_transaction,
          :repeat,
          user:,
          space:,
          account:,
          category:,
          parent: parent_transaction,
          amount: 100.00,
          description: 'Monthly expense',
          date: Date.current + 1.month
        )
      end

      context 'when update_scope is this_only' do
        it 'updates only the specific transaction' do
          result = described_class.new.call(
            id: child_transaction.id,
            user_id: user.id,
            space_id: space.id,
            amount: 150.00,
            date: child_transaction.date.to_date,
            category_name: new_category.name,
            account_name: account.name,
            description: 'Updated description',
            schedule_type: 'repeat',
            repeat_interval: 'every_month',
            repeat_count: 1,
            update_scope: 'this_only'
          )

          expect(result).to be_success

          updated_transaction = result.value!
          expect(updated_transaction.amount.amount).to eq(150.00)
          expect(updated_transaction.description).to eq('Updated description')
          expect(updated_transaction.category).to eq(new_category)

          # Parent should remain unchanged
          parent_transaction.reload
          expect(parent_transaction.amount.amount).to eq(100.00)
          expect(parent_transaction.description).to eq('Monthly expense')
          expect(parent_transaction.category).to eq(category)
        end
      end

      context 'when update_scope is all_in_series' do
        it 'updates all transactions in the series' do
          result = described_class.new.call(
            id: child_transaction.id,
            user_id: user.id,
            space_id: space.id,
            amount: 150.00,
            date: child_transaction.date.to_date,
            category_name: new_category.name,
            account_name: account.name,
            description: 'Updated description',
            schedule_type: 'repeat',
            repeat_interval: 'every_month',
            repeat_count: 1,
            update_scope: 'all_in_series'
          )

          expect(result).to be_success

          # Both transactions should be updated
          parent_transaction.reload
          child_transaction.reload

          expect(parent_transaction.amount.amount).to eq(150.00)
          expect(parent_transaction.description).to eq('Updated description')
          expect(parent_transaction.category).to eq(new_category)

          expect(child_transaction.amount.amount).to eq(150.00)
          expect(child_transaction.description).to eq('Updated description')
          expect(child_transaction.category).to eq(new_category)
        end

        it 'updates all transactions in series with schedule changes' do
          result = described_class.new.call(
            id: child_transaction.id,
            user_id: user.id,
            space_id: space.id,
            amount: 150.00,
            date: child_transaction.date.to_date,
            category_name: new_category.name,
            account_name: account.name,
            description: 'Updated description',
            schedule_type: 'repeat',
            repeat_interval: 'every_week', # Changed from every_month
            repeat_count: 1,
            update_scope: 'all_in_series'
          )

          expect(result).to be_success

          # The parent transaction should be updated
          parent_transaction.reload
          expect(parent_transaction.amount.amount).to eq(150.00)
          expect(parent_transaction.description).to eq('Updated description')
          expect(parent_transaction.category).to eq(new_category)
          expect(parent_transaction.repeat_interval).to eq('every_week')
        end
      end

      context 'when update_scope is this_and_future' do
        it 'allows schedule changes and updates future transactions' do
          result = described_class.new.call(
            id: child_transaction.id,
            user_id: user.id,
            space_id: space.id,
            amount: 150.00,
            date: child_transaction.date.to_date,
            category_name: new_category.name,
            account_name: account.name,
            description: 'Updated description',
            schedule_type: 'repeat',
            repeat_interval: 'every_week', # Changed from every_month
            repeat_count: 1,
            update_scope: 'this_and_future'
          )

          expect(result).to be_success

          # The updated transaction should have new values
          child_transaction.reload
          expect(child_transaction.amount.amount).to eq(150.00)
          expect(child_transaction.description).to eq('Updated description')
          expect(child_transaction.category).to eq(new_category)
          expect(child_transaction.repeat_interval).to eq('every_week')

          # Parent transaction should remain unchanged
          parent_transaction.reload
          expect(parent_transaction.amount.amount).to eq(100.00)
          expect(parent_transaction.description).to eq('Monthly expense')
          expect(parent_transaction.category).to eq(category)
          expect(parent_transaction.repeat_interval).to eq('every_month')
        end
      end
    end

    context 'with validation errors' do
      let!(:transaction) do
        create(
          :expense_transaction,
          :one_time,
          user:,
          space:,
          account:,
          category:
        )
      end

      it 'returns failure for invalid category' do
        result = described_class.new.call(
          id: transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 150.00,
          date: transaction.date.to_date,
          category_name: 'Non-existent Category',
          account_name: account.name,
          schedule_type: 'one_time'
        )

        expect(result).to be_failure
        expect(result.failure).to include(category_name: 'not found')
      end

      it 'returns failure for invalid update_scope' do
        result = described_class.new.call(
          id: transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 150.00,
          date: transaction.date.to_date,
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'one_time',
          update_scope: 'invalid_scope'
        )

        expect(result).to be_failure
        expect(result.failure).to include(update_scope: ["must be one of: this_only, this_and_future, all_in_series"])
      end
    end
  end

  describe '#validate' do
    let!(:transaction) do
      create(
        :expense_transaction,
        :one_time,
        user:,
        space:,
        account:,
        category:
      )
    end

    context 'with valid parameters' do
      it 'succeeds validation' do
        result = described_class.new.validate(
          params: {
            id: transaction.id,
            user_id: user.id,
            space_id: space.id,
            amount: 150.00,
            date: transaction.date.to_date,
            category_name: category.name,
            account_name: account.name,
            schedule_type: 'one_time'
          }
        )

        expect(result).to be_success
        expect(result.value!).to include(
          id: transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 150.00,
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'one_time'
        )
      end
    end

    context 'with invalid parameters' do
      it 'fails when id is missing' do
        result = described_class.new.validate(
          params: {
            user_id: user.id,
            space_id: space.id,
            amount: 150.00,
            date: transaction.date.to_date,
            category_name: category.name,
            account_name: account.name,
            schedule_type: 'one_time'
          }
        )

        expect(result).to be_failure
        expect(result.failure).to include(:id)
      end

      it 'fails when update_scope is invalid' do
        result = described_class.new.validate(
          params: {
            id: transaction.id,
            user_id: user.id,
            space_id: space.id,
            amount: 150.00,
            date: transaction.date.to_date,
            category_name: category.name,
            account_name: account.name,
            schedule_type: 'one_time',
            update_scope: 'invalid_scope'
          }
        )

        expect(result).to be_failure
        expect(result.failure).to include(update_scope: ["must be one of: this_only, this_and_future, all_in_series"])
      end

      it 'fails when required transaction parameters are missing' do
        result = described_class.new.validate(
          params: {
            id: transaction.id,
            update_scope: 'this_only'
          }
        )

        expect(result).to be_failure
        expect(result.failure).to include(:user_id)
      end
    end
  end

  describe 'Private Methods' do
    let!(:transaction) do
      create(
        :expense_transaction,
        :one_time,
        user:,
        space:,
        account:,
        category:
      )
    end

    describe '#find_transaction' do
      it 'finds existing transaction' do
        result = described_class.new.send(:find_transaction, params: { id: transaction.id })
        expect(result).to be_success
        expect(result.value!).to eq(transaction)
      end

      it 'fails when transaction not found' do
        result = described_class.new.send(:find_transaction, params: { id: 'non-existent-id' })
        expect(result).to be_failure
        expect(result.failure).to include(id: "transaction not found")
      end
    end

    describe '#find_category' do
      it 'finds existing category' do
        result = described_class.new.send(:find_category, params: { category_name: category.name, space_id: space.id })
        expect(result).to be_success
        expect(result.value!).to eq(category)
      end

      it 'fails when category not found' do
        result = described_class.new.send(:find_category, params: { category_name: 'Non-existent', space_id: space.id })
        expect(result).to be_failure
        expect(result.failure).to include(category_name: "not found")
      end
    end

    describe '#find_account' do
      it 'finds existing account' do
        result = described_class.new.send(:find_account, params: { account_name: account.name, space_id: space.id })
        expect(result).to be_success
        expect(result.value!).to eq(account)
      end

      it 'fails when account not found' do
        result = described_class.new.send(:find_account, params: { account_name: 'Non-existent', space_id: space.id })
        expect(result).to be_failure
        expect(result.failure).to include(account_name: "not found")
      end

      it 'fails when account is discarded' do
        account.discard
        result = described_class.new.send(:find_account, params: { account_name: account.name, space_id: space.id })
        expect(result).to be_failure
        expect(result.failure).to include(account_name: "not found")
      end
    end

    describe '#transform_params' do
      let(:category) { create(:category, name: 'Test Category', space:) }
      let(:account) { create(:account, name: 'Test Account', space:) }

      it 'transforms parameters correctly' do
        params = {
          user_id: user.id,
          space_id: space.id,
          amount: 100.00,
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'repeat',
          repeat_count: 5
        }

        result = described_class.new.send(:transform_params, params: params, category: category, account: account)
        expect(result).to be_success

        transformed_params = result.value!
        expect(transformed_params[:category_id]).to eq(category.id)
        expect(transformed_params[:account_id]).to eq(account.id)
        expect(transformed_params[:amount_currency]).to eq("PHP")
        expect(transformed_params[:balance_currency]).to eq("PHP")
        expect(transformed_params[:balance_cents]).to eq(0)
        expect(transformed_params[:repeat_count]).to eq(5)
        expect(transformed_params).not_to have_key(:category_name)
        expect(transformed_params).not_to have_key(:account_name)
      end

      it 'sets default repeat_count for repeat transactions' do
        params = {
          user_id: user.id,
          space_id: space.id,
          amount: 100.00,
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'repeat'
        }

        result = described_class.new.send(:transform_params, params: params, category: category, account: account)
        expect(result).to be_success

        transformed_params = result.value!
        expect(transformed_params[:repeat_count]).to eq(1)
      end

      it 'sets default installment_count for installment transactions' do
        params = {
          user_id: user.id,
          space_id: space.id,
          amount: 100.00,
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'installment'
        }

        result = described_class.new.send(:transform_params, params: params, category: category, account: account)
        expect(result).to be_success

        transformed_params = result.value!
        expect(transformed_params[:installment_count]).to eq(1)
      end
    end

    describe '#initialize_update_transaction' do
      it 'assigns attributes to transaction' do
        params = {
          amount: 200.00,
          description: 'Updated description',
          date: Date.current + 1.day
        }

        result = described_class.new.send(:initialize_update_transaction, transaction: transaction, params: params)
        expect(result).to be_success

        expect(transaction.amount.amount).to eq(200.00)
        expect(transaction.description).to eq('Updated description')
        expect(transaction.date).to eq(Date.current + 1.day)
      end

      it 'excludes id, update_scope, and file from attributes' do
        params = {
          id: 'should-be-ignored',
          update_scope: 'should-be-ignored',
          file: 'should-be-ignored',
          amount: 200.00,
          description: 'Updated description'
        }

        result = described_class.new.send(:initialize_update_transaction, transaction: transaction, params: params)
        expect(result).to be_success

        expect(transaction.amount.amount).to eq(200.00)
        expect(transaction.description).to eq('Updated description')
        expect(transaction.id).not_to eq('should-be-ignored')
      end
    end

    describe '#validate_installment_not_changed' do
      context 'when not changing installment type' do
        it 'succeeds validation' do
          transaction.schedule_type = 'one_time'
          result = described_class.new.send(:validate_installment_not_changed, transaction: transaction)
          expect(result).to be_success
        end
      end

      context 'when changing schedule type' do
        it 'succeeds validation for non-installment changes' do
          transaction.schedule_type = 'repeat'
          result = described_class.new.send(:validate_installment_not_changed, transaction: transaction)
          expect(result).to be_success
        end
      end
    end

    describe '#adjust_balance' do
      context 'when transaction is calculated and has changes' do
        before do
          transaction.update!(balance_state: 'calculated')
          transaction.amount = Money.from_amount(200.00, 'PHP')
        end

        it 'calls UpdateCalculateBalance operation' do
          update_balance_operation = instance_double(Transactions::Operations::Accounts::UpdateCalculateBalance)
          allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_return(update_balance_operation)
          allow(update_balance_operation).to receive(:call).and_return(Success(transaction))

          result = described_class.new.send(:adjust_balance, transaction: transaction)
          expect(result).to be_success

          expect(update_balance_operation).to have_received(:call).with(transaction: transaction)
        end
      end

      context 'when transaction is not calculated' do
        before do
          transaction.update!(balance_state: 'pending')
          transaction.amount = Money.from_amount(200.00, 'PHP')
        end

        it 'does not call UpdateCalculateBalance operation' do
          update_balance_operation = instance_spy(Transactions::Operations::Accounts::UpdateCalculateBalance)
          allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_return(update_balance_operation)

          result = described_class.new.send(:adjust_balance, transaction: transaction)
          expect(result).to be_success

          expect(update_balance_operation).not_to have_received(:call)
        end
      end

      context 'when transaction has no changes' do
        before do
          transaction.update!(balance_state: 'calculated')
        end

        it 'does not call UpdateCalculateBalance operation' do
          update_balance_operation = instance_spy(Transactions::Operations::Accounts::UpdateCalculateBalance)
          allow(Transactions::Operations::Accounts::UpdateCalculateBalance).to receive(:new).and_return(update_balance_operation)

          result = described_class.new.send(:adjust_balance, transaction: transaction)
          expect(result).to be_success

          expect(update_balance_operation).not_to have_received(:call)
        end
      end
    end

    describe '#update_schedule' do
      context 'when force_schedule_creation is true' do
        it 'creates schedule for one_time transactions' do
          transaction.schedule_type = 'one_time'
          params = { update_scope: 'this_and_future' }

          result = described_class.new.send(:update_schedule, transaction: transaction, params: params)
          expect(result).to be_success

          expect(transaction.schedule).to eq({})
        end

        it 'creates schedule for repeat transactions' do
          transaction.schedule_type = 'repeat'
          params = {
            update_scope: 'this_and_future',
            repeat_interval: 'every_month',
            repeat_count: 5
          }

          create_schedule_operation = instance_double(Transactions::Operations::Schedules::CreateSchedule)
          allow(Transactions::Operations::Schedules::CreateSchedule).to receive(:new).and_return(create_schedule_operation)
          allow(create_schedule_operation).to receive(:call).and_return(Success({ "every" => "month" }))

          result = described_class.new.send(:update_schedule, transaction: transaction, params: params)
          expect(result).to be_success

          expect(create_schedule_operation).to have_received(:call).with(params)
          expect(transaction.schedule).to eq({ "every" => "month" })
        end
      end

      context 'when schedule type changes' do
        it 'updates schedule' do
          transaction.schedule_type = 'repeat'
          params = { repeat_interval: 'every_week' }

          create_schedule_operation = instance_double(Transactions::Operations::Schedules::CreateSchedule)
          allow(Transactions::Operations::Schedules::CreateSchedule).to receive(:new).and_return(create_schedule_operation)
          allow(create_schedule_operation).to receive(:call).and_return(Success({ "every" => "week" }))

          result = described_class.new.send(:update_schedule, transaction: transaction, params: params)
          expect(result).to be_success

          expect(transaction.schedule).to eq({ "every" => "week" })
        end
      end

      context 'when no schedule changes are needed' do
        it 'returns success without updating schedule' do
          params = {}

          create_schedule_operation = instance_spy(Transactions::Operations::Schedules::CreateSchedule)
          allow(Transactions::Operations::Schedules::CreateSchedule).to receive(:new).and_return(create_schedule_operation)

          result = described_class.new.send(:update_schedule, transaction: transaction, params: params)
          expect(result).to be_success

          expect(create_schedule_operation).not_to have_received(:call)
        end
      end
    end

    describe '#update_repeat_transactions' do
      context 'when update_scope is blank' do
        it 'returns success without calling UpdateRepeatTransactions' do
          params = { update_scope: nil }

          update_repeat_operation = instance_spy(Transactions::Operations::UpdateRepeatTransactions)
          allow(Transactions::Operations::UpdateRepeatTransactions).to receive(:new).and_return(update_repeat_operation)

          result = described_class.new.send(:update_repeat_transactions, transaction: transaction, params: params)
          expect(result).to be_success

          expect(update_repeat_operation).not_to have_received(:call)
        end
      end

      context 'when update_scope is this_only' do
        it 'returns success without calling UpdateRepeatTransactions' do
          params = { update_scope: 'this_only' }

          update_repeat_operation = instance_spy(Transactions::Operations::UpdateRepeatTransactions)
          allow(Transactions::Operations::UpdateRepeatTransactions).to receive(:new).and_return(update_repeat_operation)

          result = described_class.new.send(:update_repeat_transactions, transaction: transaction, params: params)
          expect(result).to be_success

          expect(update_repeat_operation).not_to have_received(:call)
        end
      end

      context 'when update_scope is this_and_future' do
        it 'calls UpdateRepeatTransactions operation' do
          params = { update_scope: 'this_and_future' }

          update_repeat_operation = instance_double(Transactions::Operations::UpdateRepeatTransactions)
          allow(Transactions::Operations::UpdateRepeatTransactions).to receive(:new).and_return(update_repeat_operation)
          allow(update_repeat_operation).to receive(:call).and_return(Success(transaction))

          result = described_class.new.send(:update_repeat_transactions, transaction: transaction, params: params)
          expect(result).to be_success

          expect(update_repeat_operation).to have_received(:call).with(
            transaction: transaction,
            update_scope: 'this_and_future'
          )
        end
      end

      context 'when update_scope is all_in_series' do
        it 'calls UpdateRepeatTransactions operation' do
          params = { update_scope: 'all_in_series' }

          update_repeat_operation = instance_double(Transactions::Operations::UpdateRepeatTransactions)
          allow(Transactions::Operations::UpdateRepeatTransactions).to receive(:new).and_return(update_repeat_operation)
          allow(update_repeat_operation).to receive(:call).and_return(Success(transaction))

          result = described_class.new.send(:update_repeat_transactions, transaction: transaction, params: params)
          expect(result).to be_success

          expect(update_repeat_operation).to have_received(:call).with(
            transaction: transaction,
            update_scope: 'all_in_series'
          )
        end
      end
    end

    describe '#save_transaction' do
      it 'saves transaction successfully' do
        transaction.amount = Money.from_amount(200.00, 'PHP')
        transaction.description = 'Updated description'

        result = described_class.new.send(:save_transaction, transaction: transaction)
        expect(result).to be_success
        expect(result.value!).to eq(transaction)

        transaction.reload
        expect(transaction.amount.amount).to eq(200.00)
        expect(transaction.description).to eq('Updated description')
      end

      it 'handles save errors' do
        allow(transaction).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(transaction))

        result = described_class.new.send(:save_transaction, transaction: transaction)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end

    describe '#attach_file' do
      let(:file) { Rack::Test::UploadedFile.new(StringIO.new("test content"), "text/plain", original_filename: "test.txt") }

      context 'when file is present' do
        it 'attaches file to transaction' do
          params = { file: file, space_id: space.id }

          result = described_class.new.send(:attach_file, transaction: transaction, params: params)
          expect(result).to be_success

          expect(transaction.files.attached?).to be true
        end

        it 'replaces existing files' do
          # Attach initial file
          transaction.files.attach(
            io: StringIO.new("initial content"),
            filename: "initial.txt",
            content_type: "text/plain"
          )

          params = { file: file, space_id: space.id }

          result = described_class.new.send(:attach_file, transaction: transaction, params: params)
          expect(result).to be_success

          expect(transaction.files.count).to eq(1)
        end
      end

      context 'when file is blank' do
        it 'returns success without attaching file' do
          params = { file: nil, space_id: space.id }

          result = described_class.new.send(:attach_file, transaction: transaction, params: params)
          expect(result).to be_success

          expect(transaction.files.attached?).to be false
        end
      end
    end
  end

  describe 'Error Handling' do
    let!(:transaction) do
      create(
        :expense_transaction,
        :one_time,
        user:,
        space:,
        account:,
        category:
      )
    end

    context 'when transaction not found' do
      it 'returns failure' do
        result = described_class.new.call(
          id: 'non-existent-id',
          user_id: user.id,
          space_id: space.id,
          amount: 150.00,
          date: transaction.date.to_date,
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'one_time'
        )

        expect(result).to be_failure
        expect(result.failure).to include(id: "transaction not found")
      end
    end

    context 'when category not found' do
      it 'returns failure' do
        result = described_class.new.call(
          id: transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 150.00,
          date: transaction.date.to_date,
          category_name: 'Non-existent Category',
          account_name: account.name,
          schedule_type: 'one_time'
        )

        expect(result).to be_failure
        expect(result.failure).to include(category_name: "not found")
      end
    end

    context 'when account not found' do
      it 'returns failure' do
        result = described_class.new.call(
          id: transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 150.00,
          date: transaction.date.to_date,
          category_name: category.name,
          account_name: 'Non-existent Account',
          schedule_type: 'one_time'
        )

        expect(result).to be_failure
        expect(result.failure).to include(account_name: "not found")
      end
    end

    context 'when updating transaction with different schedule type' do
      it 'succeeds with schedule type change' do
        result = described_class.new.call(
          id: transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 150.00,
          date: transaction.date.to_date,
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'repeat',
          repeat_interval: 'every_month',
          repeat_count: 5
        )

        expect(result).to be_success
        expect(result.value!.schedule_type).to eq('repeat')
      end
    end
  end
end
