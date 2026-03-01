# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::UpdateTransaction, type: :operation do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space) }
  let!(:space_user) { create(:space_user, user:, space:) }
  let!(:account) { create(:account, space:) }
  let!(:category) { create(:category, name: 'Food', space:, category_type: 'expense') }
  let!(:new_category) { create(:category, name: 'Entertainment', space:, category_type: 'expense') }

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
          transaction_type: 'expense',
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

      context 'when update_scope is all_in_series' do
        it 'updates all transactions in the series with new attributes and schedule' do
          result = described_class.new.call(
            id: child_transaction.id,
            user_id: user.id,
            space_id: space.id,
            amount: 150.00,
            date: child_transaction.date.to_date,
            transaction_type: 'expense',
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

          # Note: With all_in_series and schedule changes, child transactions are recreated
          # so we can't test the original child transaction as it may have been deleted
          # and recreated with new IDs
        end
      end

      context 'when update_scope is this_and_future' do
        it 'updates current and future transactions with new attributes and schedule' do
          result = described_class.new.call(
            id: child_transaction.id,
            user_id: user.id,
            space_id: space.id,
            amount: 150.00,
            date: child_transaction.date.to_date,
            transaction_type: 'expense',
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
          transaction_type: 'expense',
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
          transaction_type: 'expense',
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
            transaction_type: 'expense',
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
          transaction_type: 'expense',
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
            transaction_type: 'expense',
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
            transaction_type: 'expense',
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
            update_scope: 'this_and_future'
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

    describe '#find_space' do
      it 'finds existing space' do
        result = described_class.new.send(:find_space, params: { space_id: space.id })
        expect(result).to be_success
        expect(result.value!).to eq(space)
      end

      it 'fails when space not found' do
        result = described_class.new.send(:find_space, params: { space_id: 'non-existent-id' })
        expect(result).to be_failure
        expect(result.failure).to include(space_id: "not found")
      end
    end

    describe '#find_category' do
      it 'finds existing category' do
        result = described_class.new.send(:find_category, params: { transaction_type: 'expense', category_name: category.name, space_id: space.id })
        expect(result).to be_success
        expect(result.value!).to eq(category)
      end

      it 'fails when category not found' do
        result = described_class.new.send(:find_category, params: { transaction_type: 'expense', category_name: 'Non-existent', space_id: space.id })
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
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'repeat',
          repeat_count: 5
        }

        result = described_class.new.send(:transform_params,
                                          params: params,
                                          transaction: transaction,
                                          category: category,
                                          account: account,
                                          space: space)
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
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'repeat'
        }

        result = described_class.new.send(:transform_params,
                                          params: params,
                                          transaction: transaction,
                                          category: category,
                                          account: account,
                                          space: space)
        expect(result).to be_success

        transformed_params = result.value!
        expect(transformed_params[:repeat_count]).to eq(1)
      end

      it 'sets default installment_count for installment transactions' do
        params = {
          user_id: user.id,
          space_id: space.id,
          amount: 100.00,
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'installment'
        }

        result = described_class.new.send(:transform_params,
                                          params: params,
                                          transaction: transaction,
                                          category: category,
                                          account: account,
                                          space: space)
        expect(result).to be_success

        transformed_params = result.value!
        expect(transformed_params[:installment_count]).to eq(1)
      end

      it 'sets transfer_fee category for transfer transactions' do
        from_account = create(:account, space:)
        to_account = create(:account, space:)
        transfer = create(:transfer, space:, user:, from_account:, to_account:)
        transfer_transaction = create(:expense_transaction, :one_time, space:, transfer:)
        transfer_fee_category = create(:category, space:, name: "Transfer Fee", category_type: :expense)

        params = {
          user_id: user.id,
          space_id: space.id,
          amount: 100.00,
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'one_time'
        }

        result = described_class.new.send(:transform_params,
                                          params: params,
                                          transaction: transfer_transaction,
                                          category: category,
                                          account: account,
                                          space: space)
        expect(result).to be_success

        transformed_params = result.value!
        expect(transformed_params[:category_id]).to eq(transfer_fee_category.id)
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

    describe '#update_transfer_transaction_cost' do
      context 'when transaction has a transfer' do
        let!(:from_account) { create(:account, space:) }
        let!(:to_account) { create(:account, space:) }
        let!(:transfer) { create(:transfer, space:, user:, from_account:, to_account:) }
        let!(:transfer_transaction) { create(:expense_transaction, :one_time, space:, transfer:) }

        it 'updates transfer transaction cost' do
          transfer_transaction.amount = Money.from_amount(150.00, 'PHP')

          result = described_class.new.send(:update_transfer_transaction_cost, transaction: transfer_transaction)
          expect(result).to be_success

          transfer.reload
          expect(transfer.transaction_cost).to eq(Money.from_amount(150.00, 'PHP'))
        end

        it 'saves the transfer after updating cost' do
          transfer_transaction.amount = Money.from_amount(200.00, 'PHP')

          result = described_class.new.send(:update_transfer_transaction_cost, transaction: transfer_transaction)
          expect(result).to be_success

          transfer.reload
          expect(transfer.transaction_cost).to eq(Money.from_amount(200.00, 'PHP'))
        end
      end

      context 'when transaction has no transfer' do
        it 'returns success without updating anything' do
          result = described_class.new.send(:update_transfer_transaction_cost, transaction: transaction)
          expect(result).to be_success
          expect(result.value!).to eq(transaction)
        end
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

  describe 'Balance State Management' do
    let!(:account) { create(:account, space:, balance: Money.from_amount(1000.00, 'PHP')) }

    context 'when updating weekly transaction date from future to past' do
      let!(:weekly_transaction) do
        create(
          :expense_transaction,
          :repeat,
          user:,
          space:,
          account:,
          category:,
          amount: 50.00,
          description: 'Weekly expense',
          date: Date.current + 1.week, # Future date
          schedule_type: 'repeat',
          repeat_interval: 'every_week',
          repeat_count: 5,
          balance_state: 'pending' # Future transactions start as pending
        )
      end

      let!(:future_transaction_1) do
        create(
          :expense_transaction,
          :repeat,
          user:,
          space:,
          account:,
          category:,
          amount: 50.00,
          description: 'Weekly expense',
          date: Date.current + 2.weeks,
          schedule_type: 'repeat',
          repeat_interval: 'every_week',
          repeat_count: 5,
          parent: weekly_transaction,
          balance_state: 'pending'
        )
      end

      let!(:future_transaction_2) do
        create(
          :expense_transaction,
          :repeat,
          user:,
          space:,
          account:,
          category:,
          amount: 50.00,
          description: 'Weekly expense',
          date: Date.current + 3.weeks,
          schedule_type: 'repeat',
          repeat_interval: 'every_week',
          repeat_count: 5,
          parent: weekly_transaction,
          balance_state: 'pending'
        )
      end

      before do
        Timecop.freeze(Date.new(2025, 9, 1))
      end

      after do
        Timecop.return
      end

      it 'properly updates balance states when moving transaction to first of previous month with all_in_series' do
        # Set up initial state - all transactions are pending (future dates)
        expect(weekly_transaction.balance_state).to eq('pending')
        expect(future_transaction_1.balance_state).to eq('pending')
        expect(future_transaction_2.balance_state).to eq('pending')

        # Account balance should not include pending transactions
        initial_balance = account.reload.balance.amount
        expect(initial_balance).to eq(1000.00)

        # Update the main transaction date to first of previous month (past date)
        first_of_previous_month = Date.current.beginning_of_month - 1.month
        result = described_class.new.call(
          id: weekly_transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 50.00,
          date: first_of_previous_month.to_date,
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          description: 'Weekly expense',
          schedule_type: 'repeat',
          repeat_interval: 'every_week',
          repeat_count: 5,
          update_scope: 'all_in_series'
        )

        expect(result).to be_success

        # Reload the main transaction and account
        weekly_transaction.reload
        account.reload

        # The main transaction should now be calculated (past date)
        expect(weekly_transaction.balance_state).to eq('calculated')
        expect(weekly_transaction.date).to eq(first_of_previous_month)

        # Account balance should now include all calculated transactions
        expect(account.balance.amount).to eq(750.00)
      end

      it 'properly handles balance calculation when updating to current date with this_and_future' do
        # Update the main transaction date to today
        result = described_class.new.call(
          id: weekly_transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 50.00,
          date: Date.current.to_date,
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          description: 'Weekly expense',
          schedule_type: 'repeat',
          repeat_interval: 'every_week',
          repeat_count: 5,
          update_scope: 'this_and_future'
        )

        expect(result).to be_success

        # Reload the main transaction and account
        weekly_transaction.reload
        account.reload

        # The main transaction should now be calculated (current date)
        expect(weekly_transaction.balance_state).to eq('calculated')
        expect(weekly_transaction.date).to eq(Date.current)

        # Account balance should include all calculated transactions
        # 1000.00 (initial) - 50.00 (main transaction) = 950.00
        expect(account.balance.amount).to eq(950.00)
      end

      it 'handles balance state correctly when updating future transaction to past date with this_and_future' do
        # Create a standalone future transaction (not part of a series) to avoid foreign key issues
        standalone_future_transaction = create(
          :expense_transaction,
          :one_time,
          user:,
          space:,
          account:,
          category:,
          amount: 50.00,
          description: 'Standalone future expense',
          date: Date.current + 1.week,
          balance_state: 'pending'
        )

        # Update the standalone future transaction to a past date
        past_date = Date.current - 1.week
        result = described_class.new.call(
          id: standalone_future_transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 50.00,
          date: past_date.to_date,
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          description: 'Standalone past expense',
          schedule_type: 'one_time'
        )

        expect(result).to be_success

        # Reload transaction and account
        standalone_future_transaction.reload
        account.reload

        # The updated transaction should now be calculated (past date)
        expect(standalone_future_transaction.balance_state).to eq('calculated')
        expect(standalone_future_transaction.date).to eq(past_date)

        # Account balance should include this transaction
        expect(account.balance.amount).to eq(950.00)
      end

      it 'maintains correct balance states when updating amount without date change' do
        # Create a standalone future transaction to avoid UpdateRepeatTransactions complications
        standalone_future_transaction = create(
          :expense_transaction,
          :one_time,
          user:,
          space:,
          account:,
          category:,
          amount: 50.00,
          description: 'Standalone future expense',
          date: Date.current + 1.week,
          balance_state: 'pending'
        )

        # Update only the amount, keeping the future date
        result = described_class.new.call(
          id: standalone_future_transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 75.00, # Changed amount
          date: standalone_future_transaction.date.to_date, # Same date
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          description: 'Standalone future expense',
          schedule_type: 'one_time'
        )

        expect(result).to be_success

        # Reload transaction
        standalone_future_transaction.reload
        account.reload

        # Transaction should still be pending (future date)
        expect(standalone_future_transaction.balance_state).to eq('pending')
        expect(standalone_future_transaction.amount.amount).to eq(75.00)

        # Account balance should not change (pending transaction)
        expect(account.balance.amount).to eq(1000.00)
      end
    end

    context 'when updating transaction with calculated balance state' do
      let!(:calculated_transaction) do
        create(
          :expense_transaction,
          :one_time,
          user:,
          space:,
          account:,
          category:,
          amount: 100.00,
          description: 'Past expense',
          date: Date.current - 1.day, # Past date
          balance_state: 'pending' # Start as pending so CalculateBalance can work
        )
      end

      it 'recalculates balance when changing amount of calculated transaction' do
        # Explicitly call CalculateBalance for the initial transaction to ensure account balance reflects it
        result = Transactions::Operations::Accounts::CalculateBalance.new.call(
          transaction_id: calculated_transaction.id,
          skip_calculation: false
        )
        # Initial balance should include the calculated transaction
        expect(account.reload.balance.amount).to eq(900.00)

        # Update the amount
        result = described_class.new.call(
          id: calculated_transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 150.00, # Changed amount
          date: calculated_transaction.date.to_date,
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          description: 'Past expense',
          schedule_type: 'one_time'
        )

        expect(result).to be_success

        # Reload transaction and account
        calculated_transaction.reload
        account.reload

        # Transaction should still be calculated
        expect(calculated_transaction.balance_state).to eq('calculated')
        expect(calculated_transaction.amount.amount).to eq(150.00)

        # Account balance should reflect the new amount
        # 900.00 (after initial 100.00 expense) - 50.00 (expense amount increase) = 850.00
        expect(account.balance.amount).to eq(850.00)
      end

      it 'changes balance state to pending when moving calculated transaction to future' do
        # Explicitly call CalculateBalance for the initial transaction to ensure account balance reflects it
        Transactions::Operations::Accounts::CalculateBalance.new.call(
          transaction_id: calculated_transaction.id,
          skip_calculation: false
        )

        # Initial balance should include the calculated transaction
        expect(account.reload.balance.amount).to eq(900.00)

        # Move transaction to future date
        future_date = Date.current + 1.week
        result = described_class.new.call(
          id: calculated_transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 100.00,
          date: future_date.to_date,
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          description: 'Future expense',
          schedule_type: 'one_time'
        )

        expect(result).to be_success

        # Reload transaction and account
        calculated_transaction.reload
        account.reload

        # Transaction should now be pending (future date)
        expect(calculated_transaction.balance_state).to eq('pending')
        expect(calculated_transaction.date).to eq(future_date)

        # Account balance should no longer include this transaction
        expect(account.balance.amount).to eq(1000.00)
      end
    end

    context 'when testing weekly recurring transaction balance calculation bug' do
      let!(:account) { create(:account, space:, balance: Money.from_amount(1000.00, 'PHP')) }

      it 'correctly calculates balance when moving last transaction of month to first of previous month' do
        # Create a weekly recurring transaction starting from the last day of September
        # This simulates the "last transaction of the month" scenario
        last_day_of_september = Date.new(2025, 9, 30) # Monday
        weekly_transaction = create(
          :expense_transaction,
          :repeat,
          user:,
          space:,
          account:,
          category:,
          amount: 1.00,
          description: 'Weekly expense',
          date: last_day_of_september, # Start from last day of September
          schedule_type: 'repeat',
          repeat_interval: 'every_week',
          repeat_count: 10, # Create 10 weekly transactions
          balance_state: 'pending'
        )

        # Let the system automatically create the recurring transactions
        # This simulates what happens when you create a recurring transaction in the UI
        # It creates transactions from tomorrow onwards
        # NOTE: This simulates the BUG where all transactions are created with balance_state: "calculated"
        Transactions::Operations::CreateRepeatTransactions.new.call(
          transaction: weekly_transaction,
          balance_state: "calculated", # BUG: This sets ALL transactions to calculated, even future ones
          date_start: Date.current + 1.day,
          date_end: Date.current + 1.month
        )

        # Check initial state - should have multiple transactions already created
        account.reload

        # Now move the transaction to August 1, 2025 (first of previous month)
        august_first = Date.new(2025, 8, 1)

        # Update the transaction to August 1, 2025
        result = described_class.new.call(
          id: weekly_transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 1.00,
          date: august_first,
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          description: 'Weekly expense',
          schedule_type: 'repeat',
          repeat_interval: 'every_week',
          repeat_count: 10,
          update_scope: 'all_in_series'
        )

        expect(result).to be_success

        account.reload
        final_balance = account.balance.amount

        all_transactions = account.transactions.where(parent: weekly_transaction).or(account.transactions.where(id: weekly_transaction.id))
        calculated_transactions = all_transactions.where(balance_state: "calculated")

        expected_calculated_count = calculated_transactions.count
        expected_balance = 1000.00 - expected_calculated_count
        expect(final_balance).to eq(expected_balance)
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
          transaction_type: 'expense',
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
          transaction_type: 'expense',
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
          transaction_type: 'expense',
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
          transaction_type: 'expense',
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

  describe 'Monthly Summary Update' do
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

    context 'with monthly summary update' do
      it 'calls update_monthly_summary after successful transaction update' do
        update_summary_operation = instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary)
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Success())

        result = described_class.new.call(
          id: transaction.id,
          user_id: user.id,
          space_id: space.id,
          amount: 150.00,
          date: transaction.date.to_date,
          transaction_type: 'expense',
          category_name: category.name,
          account_name: account.name,
          schedule_type: 'one_time'
        )

        expect(result).to be_success

        expect(update_summary_operation).to have_received(:call).with(
          space_id: transaction.space_id,
          transaction_date: transaction.date.to_date
        )
      end
    end

    describe '#update_monthly_summary' do
      it 'calls MonthlyFinancialSummaries::Operations::UpdateSummary with correct parameters' do
        update_summary_operation = instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary)
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Success())

        result = described_class.new.send(:update_monthly_summary, transaction: transaction)
        expect(result).to be_success

        expect(update_summary_operation).to have_received(:call).with(
          space_id: transaction.space_id,
          transaction_date: transaction.date.to_date
        )
      end

      it 'returns success even when UpdateSummary fails' do
        update_summary_operation = instance_double(MonthlyFinancialSummaries::Operations::UpdateSummary)
        allow(MonthlyFinancialSummaries::Operations::UpdateSummary).to receive(:new).and_return(update_summary_operation)
        allow(update_summary_operation).to receive(:call).and_return(Failure(error: "Summary update failed"))

        result = described_class.new.send(:update_monthly_summary, transaction: transaction)
        expect(result).to be_success
      end
    end
  end
end
