# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Queries::FilteredTransactions, type: :query do # Using :query type for convention
  # Use let! for records that need to exist before each example
  let!(:space1) { create(:personal_space, code: 'space-1') }
  let!(:space2) { create(:personal_space, code: 'space-2') }

  let!(:account1_s1) { create(:account, space: space1) }
  let!(:account2_s1) { create(:account, space: space1) }
  let!(:account1_s2) { create(:account, space: space2) }

  let!(:category1_s1) { create(:category, name: 'Category 1', space: space1) }
  let!(:category2_s1) { create(:category, name: 'Category 2', space: space1) }
  let!(:category1_s2) { create(:category, name: 'Category 1', space: space2) }

  # Transactions in Space 1
  let!(:transaction_s1_jan5) { create(:transaction, space: space1, account: account1_s1, category: category1_s1, date: Date.new(2024, 1, 5), amount_cents: 1000) }
  let!(:transaction_s1_jan15) { create(:transaction, space: space1, account: account2_s1, category: category2_s1, date: Date.new(2024, 1, 15), amount_cents: 2000) }
  let!(:transaction_s1_feb10) { create(:transaction, space: space1, account: account1_s1, category: category1_s1, date: Date.new(2024, 2, 10), amount_cents: 500) }

  # Transactions in Space 2
  let!(:transaction_s2_jan20) { create(:transaction, space: space2, account: account1_s2, category: category1_s2, date: Date.new(2024, 1, 20), amount_cents: 3000) }
  let!(:transaction_s2_feb5) { create(:transaction, space: space2, account: account1_s2, category: category1_s2, date: Date.new(2024, 2, 5), amount_cents: 1500) }

  # Helper to call the query object
  def call_query(params = {})
    # Pass the base relation explicitly if needed, although the query sets a default
    # described_class.call(relation: Transactions::Transaction.all, params: params)
    described_class.call(params: params)
  end

  describe '#call' do
    context 'without filters' do
      it 'returns all transactions ordered correctly' do
        result = call_query
        # Compare IDs instead of full objects
        expected_ids = [ transaction_s1_jan5, transaction_s1_jan15, transaction_s1_feb10, transaction_s2_jan20, transaction_s2_feb5 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        # Check default order (date desc)
        expect(result.first.id).to eq(transaction_s1_feb10.id)
        expect(result.last.id).to eq(transaction_s1_jan5.id)
      end
    end

    context 'with space_code filter' do
      it 'returns only transactions for the specified space' do
        result = call_query(space_code: 'space-1')
        expected_ids = [ transaction_s1_jan5, transaction_s1_jan15, transaction_s1_feb10 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        # Optionally check one specific non-included ID
        expect(result.map(&:id)).not_to include(transaction_s2_jan20.id)
      end

      it 'returns nothing for a space with no transactions' do
        space3 = create(:personal_space, code: 'space-3')
        result = call_query(space_code: 'space-3')
        expect(result).to be_empty
      end
    end

    context 'with date filters' do
      it 'filters by start_date only' do
        result = call_query(start_date: '2024-01-16')
        expected_ids = [ transaction_s1_feb10, transaction_s2_jan20, transaction_s2_feb5 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_jan5.id)
      end

      it 'filters by end_date only' do
        result = call_query(end_date: '2024-01-31')
        expected_ids = [ transaction_s1_jan5, transaction_s1_jan15, transaction_s2_jan20 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_feb10.id)
      end

      it 'filters by both start_date and end_date' do
        result = call_query(start_date: '2024-01-10', end_date: '2024-02-06')
        expected_ids = [ transaction_s1_jan15, transaction_s2_jan20, transaction_s2_feb5 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_jan5.id)
      end
    end

    context 'with pagination' do
      let!(:more_transactions_s1) do
        25.times.map do |i|
          # Ensure unique category names if factory doesn't handle it
          category = create(:category, name: "Pag Cat #{i}", space: space1)
          create(:transaction, space: space1, account: account1_s1, category: category, date: Date.new(2024, 3, 1) + i.days)
        end
      end

      it 'returns the first page of results' do
        result = call_query(space_code: 'space-1', page: 1)
        # Check size of the loaded array instead of calling .count
        expect(result.size).to eq(25)
        expect(result.map(&:id)).to include(more_transactions_s1.last.id)
        expect(result.map(&:id)).not_to include(transaction_s1_jan5.id, transaction_s1_jan15.id, transaction_s1_feb10.id)
      end

      it 'returns the second page of results' do
        result = call_query(space_code: 'space-1', page: 2)
        # Check size of the loaded array
        expect(result.size).to eq(3)
        expect(result.map(&:id)).to contain_exactly(transaction_s1_jan5.id, transaction_s1_jan15.id, transaction_s1_feb10.id)
      end
    end

    context 'with combined filters' do
      it 'filters by space and date range' do
        result = call_query(space_code: 'space-1', start_date: '2024-01-01', end_date: '2024-01-31')
        expected_ids = [ transaction_s1_jan5, transaction_s1_jan15 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_feb10.id)
      end
    end
  end
end
