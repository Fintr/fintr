# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Queries::LastRecord, type: :query do
  let!(:space) { create(:personal_space, code: 'test-space') }
  let!(:account) { create(:account, space:) }
  let!(:category) { create(:category, name: 'Test Category', space:) }

  # Create parent transaction
  let!(:parent_transaction) do
    create(
      :income_transaction,
      space:,
      account:,
      category:,
      date: Date.new(2024, 1, 15),
      amount_cents: 1000
    )
  end

  # Create child transactions with different dates
  let!(:child_transaction_1) do
    create(
      :income_transaction,
      space:,
      account:,
      category:,
      parent: parent_transaction,
      date: Date.new(2024, 2, 15),
      amount_cents: 1000
    )
  end

  let!(:child_transaction_2) do
    create(
      :income_transaction,
      space:,
      account:,
      category:,
      parent: parent_transaction,
      date: Date.new(2024, 3, 15),
      amount_cents: 1000
    )
  end

  # Create an unrelated transaction
  let!(:unrelated_transaction) do
    create(
      :income_transaction,
      space:,
      account:,
      category:,
      date: Date.new(2024, 3, 20),
      amount_cents: 1500
    )
  end

  describe '#call' do
    context 'with valid parameters' do
      it 'returns the latest transaction in the group before the cutoff date' do
        # Using a date that includes all transactions
        params = {
          record: parent_transaction,
          date_end: Date.new(2024, 4, 1)
        }

        result = described_class.call(params:)

        # Should return the latest child transaction
        expect(result.value!).to eq(child_transaction_2)
      end

      it 'returns the parent transaction if no children match the date criteria' do
        # Using a date that only includes the parent transaction
        params = {
          record: parent_transaction,
          date_end: Date.new(2024, 1, 20)
        }

        result = described_class.call(params:)

        # Should return the parent transaction
        expect(result.value!).to eq(parent_transaction)
      end

      it 'returns an earlier child transaction based on the date criteria' do
        # Using a date that includes the parent and one child
        params = {
          record: parent_transaction,
          date_end: Date.new(2024, 2, 20)
        }

        result = described_class.call(params:)

        # Should return the first child transaction
        expect(result.value!).to eq(child_transaction_1)
      end

      it 'works when using a child id as the record_id parameter' do
        # Using a child ID instead of the parent ID
        params = {
          record: child_transaction_1,
          date_end: Date.new(2024, 3, 20)
        }

        result = described_class.call(params:)

        # Should still return the latest transaction in the group
        expect(result.value!.id).to eq(child_transaction_2.id)
      end
    end

    context 'when validation fails' do
      it 'returns a failure for missing record_id' do
        params = { date_end: Date.new(2024, 4, 1) }
        result = described_class.call(params:)

        expect(result).to be_failure
        expect(result.failure).to include(record: ["is missing"])
      end

      it 'returns a failure for missing date_end' do
        params = { record: parent_transaction }
        result = described_class.call(params:)

        expect(result).to be_failure
        expect(result.failure).to include(:date_end)
      end

      it 'returns a failure for invalid date_end' do
        params = {
          record: parent_transaction,
          date_end: 'not-a-date'
        }
        result = described_class.call(params:)

        expect(result).to be_failure
        expect(result.failure).to include(:date_end)
      end
    end

    context 'when not an accepted record' do
      it 'returns a failure' do
        params = {
          record: 'non-existent-id',
          date_end: Date.new(2024, 4, 1)
        }

        result = described_class.call(params:)

        # The query should still succeed but return nil
        expect(result).to be_failure
        expect(result.failure).to include(record: ["must be an instance of Transaction, Expense, Income, Transfer"])
      end
    end
  end

  describe '#where' do
    it 'builds a relation with the correct conditions' do
      query = described_class.new
      params = {
        record: parent_transaction,
        date_end: Date.new(2024, 4, 1)
      }

      result = query.where(relation: Transactions::Transaction.all, params:).value!

      # Verify it contains all related transactions
      expect(result).to include(parent_transaction, child_transaction_1, child_transaction_2)
      expect(result).not_to include(unrelated_transaction)
    end
  end

  describe '#order' do
    it 'orders the transactions by date in descending order' do
      query = described_class.new
      relation = Transactions::Transaction.where(id: [
        parent_transaction.id,
        child_transaction_1.id,
        child_transaction_2.id
      ])

      result = query.order(relation:).value!

      # Verify the order is by date descending
      expect(result.first).to eq(child_transaction_2)
      expect(result.second).to eq(child_transaction_1)
      expect(result.last).to eq(parent_transaction)
    end
  end
end
