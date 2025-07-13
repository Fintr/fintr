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

        it 'prevents schedule changes when updating all in series' do
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

          expect(result).to be_failure
          expect(result.failure).to include(schedule: "Cannot change schedule settings when updating all transactions in series. Use 'this_and_future' instead.")
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
end
