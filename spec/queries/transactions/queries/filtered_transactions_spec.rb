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

  # Define default params that meet contract requirements
  let(:default_params) do
    {
      page: 1,
      space_code: 'space-1',
      category_name: 'all',
      start_date: Date.new(2024, 1, 1),
      end_date: Date.new(2024, 2, 28)
    }
  end

  describe '#call' do
    context 'without filters' do
      it 'returns all transactions ordered correctly' do
        # Use all default params, which will retrieve all transactions due to date range
        result = described_class.call(params: default_params).value!

        # Compare IDs instead of full objects
        expected_ids = [ transaction_s1_jan5, transaction_s1_jan15, transaction_s1_feb10 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)

        # Check default order (date asc)
        expect(result.first.id).to eq(transaction_s1_jan5.id)
        expect(result.last.id).to eq(transaction_s1_feb10.id)
      end
    end

    context 'with space_code filter' do
      it 'returns only transactions for the specified space' do
        # Use space2's code but keep other defaults
        params = default_params.merge(space_code: 'space-2')
        result = described_class.call(params: params).value!

        expected_ids = [ transaction_s2_jan20, transaction_s2_feb5 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)

        # Optionally check one specific non-included ID
        expect(result.map(&:id)).not_to include(transaction_s1_jan5.id)
      end

      it 'returns nothing for a space with no transactions' do
        space3 = create(:personal_space, code: 'space-3')
        params = default_params.merge(space_code: 'space-3')
        result = described_class.call(params: params).value!

        expect(result).to be_empty
      end
    end

    context 'with date filters' do
      it 'filters by start_date' do
        # Use a later start_date to filter out Jan transactions
        params = default_params.merge(start_date: Date.new(2024, 1, 16))
        result = described_class.call(params: params).value!

        expected_ids = [ transaction_s1_feb10 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_jan5.id, transaction_s1_jan15.id)
      end

      it 'filters by end_date' do
        # Use earlier end_date to filter out Feb transactions
        params = default_params.merge(end_date: Date.new(2024, 1, 31))
        result = described_class.call(params: params).value!

        expected_ids = [ transaction_s1_jan5, transaction_s1_jan15 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_feb10.id)
      end

      it 'filters by both start_date and end_date' do
        # Use a date range that only includes jan15
        params = default_params.merge(
          start_date: Date.new(2024, 1, 10),
          end_date: Date.new(2024, 1, 20)
        )
        result = described_class.call(params: params).value!

        expected_ids = [ transaction_s1_jan15 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_jan5.id, transaction_s1_feb10.id)
      end
    end

    context 'with category filter' do
      it 'filters by category name' do
        params = default_params.merge(category_name: 'Category 1')
        result = described_class.call(params: params).value!

        expected_ids = [ transaction_s1_jan5, transaction_s1_feb10 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_jan15.id)
      end

      it 'returns no results for non-existent category' do
        params = default_params.merge(category_name: 'Non-existent Category')
        result = described_class.call(params: params).value!

        expect(result).to be_empty
      end
    end

    context 'with pagination' do
      let!(:additional_transactions) do
        # Create just 3 more transactions (in addition to the 3 we already have)
        3.times.map do |i|
          category = create(:category, name: "Pag Cat #{i}", space: space1)
          create(:transaction, space: space1, account: account1_s1, category: category, date: Date.new(2024, 3, 1) + i.days)
        end
      end

      it 'returns the first page of results with custom per_page' do
        params = default_params.merge(
          page: 1,
          per_page: 3,
          end_date: Date.new(2024, 4, 1)
        )
        result = described_class.call(params: params).value!

        # Should return exactly 3 transactions
        expect(result.size).to eq(3)
        # First page should have the oldest transactions (January-February)
        expect(result.map(&:id)).to contain_exactly(transaction_s1_jan5.id, transaction_s1_jan15.id, transaction_s1_feb10.id)
      end

      it 'returns the second page of results with custom per_page' do
        params = default_params.merge(
          page: 2,
          per_page: 3,
          end_date: Date.new(2024, 4, 1)
        )
        result = described_class.call(params: params).value!

        # Second page should have the 3 additional March transactions
        expect(result.size).to eq(3)
        expect(result.map(&:id)).to match_array(additional_transactions.map(&:id))
      end
    end

    context 'with combined filters' do
      it 'filters by space, date range, and category' do
        params = default_params.merge(
          space_code: 'space-1',
          category_name: 'Category 1',
          start_date: Date.new(2024, 1, 1),
          end_date: Date.new(2024, 1, 31)
        )
        result = described_class.call(params: params).value!

        expected_ids = [ transaction_s1_jan5 ].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_jan15.id, transaction_s1_feb10.id)
      end
    end

    context 'when validation fails' do
      it 'returns a failure for invalid space_code' do
        params = default_params.merge(space_code: '')
        result = described_class.call(params: params)

        expect(result).to be_failure
        expect(result.failure).to include(:space_code)
      end

      it 'returns a failure for non-date values' do
        params = default_params.merge(start_date: 'not-a-date')
        result = described_class.call(params: params)

        expect(result).to be_failure
        expect(result.failure).to include(:start_date)
      end

      it 'returns a failure for non-integer page' do
        params = default_params.merge(page: 'first')
        result = described_class.call(params: params)

        expect(result).to be_failure
        expect(result.failure).to include(:page)
      end
    end
  end
end
