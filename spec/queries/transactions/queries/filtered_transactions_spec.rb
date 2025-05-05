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

  let!(:first_3_transactions) { [transaction_s1_jan5, transaction_s1_jan15, transaction_s1_feb10] }

  # Define transfers for testing combined view
  let!(:transfer_s1_jan10) do
    create(:transfer,
           space: space1,
           from_account: account1_s1,
           to_account: account2_s1,
           date: Date.new(2024, 1, 10),
           amount_cents: 1200)
  end

  let!(:transfer_s1_feb5) do
    create(:transfer,
           space: space1,
           from_account: account2_s1,
           to_account: account1_s1,
           date: Date.new(2024, 2, 5),
           amount_cents: 800)
  end

  let!(:transfers_s1) { [transfer_s1_jan10, transfer_s1_feb5] }

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
        # Create a query instance with relation argument
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: default_params).call

        # Compare IDs instead of full objects
        expected_ids = [transaction_s1_jan5, transaction_s1_jan15, transaction_s1_feb10].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)

        # Check default order (date desc)
        ordered_ids = result.map(&:id)
        # Feb 10 should be first (most recent)
        expect(ordered_ids.first).to eq(transaction_s1_feb10.id)
        # Jan 5 should be last (oldest)
        expect(ordered_ids.last).to eq(transaction_s1_jan5.id)
      end

      it 'returns all transactions and transfers when include_transfers is true' do
        # Create a query instance with include_transfers set to true
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: default_params, include_transfers: true).call

        # We should have 5 records total (3 transactions + 2 transfers)
        expect(result.size).to eq(5)

        # Verify transactions are included
        transaction_ids = [transaction_s1_jan5, transaction_s1_jan15, transaction_s1_feb10].map(&:id)
        result_transaction_ids = result.select { |r| r.transaction_type != 'transfer' }.map(&:id)
        expect(result_transaction_ids).to match_array(transaction_ids)

        # Verify transfers are included
        transfer_records = result.select { |r| r.transaction_type == 'transfer' }
        expect(transfer_records.size).to eq(2)
        expect(transfer_records.map(&:id)).to match_array(transfers_s1.map(&:id))

        # Verify records are ordered by date
        expect(result.map(&:date)).to eq(result.map(&:date).sort.reverse)
      end
    end

    context 'with space_code filter' do
      it 'returns only transactions for the specified space' do
        # Use space2's code but keep other defaults
        params = default_params.merge(space_code: 'space-2')
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        expected_ids = [transaction_s2_jan20, transaction_s2_feb5].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)

        # Optionally check one specific non-included ID
        expect(result.map(&:id)).not_to include(transaction_s1_jan5.id)
      end

      it 'returns nothing for a space with no transactions' do
        space3 = create(:personal_space, code: 'space-3')
        params = default_params.merge(space_code: 'space-3')
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        expect(result).to be_empty
      end
    end

    context 'with date filters' do
      it 'filters by start_date' do
        # Use a later start_date to filter out Jan transactions
        params = default_params.merge(start_date: Date.new(2024, 1, 16))
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        expected_ids = [transaction_s1_feb10].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_jan5.id, transaction_s1_jan15.id)
      end

      it 'filters by end_date' do
        # Use earlier end_date to filter out Feb transactions
        params = default_params.merge(end_date: Date.new(2024, 1, 31))
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        expected_ids = [transaction_s1_jan5, transaction_s1_jan15].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_feb10.id)
      end

      it 'filters by both start_date and end_date' do
        # Use a date range that only includes jan15
        params = default_params.merge(
          start_date: Date.new(2024, 1, 10),
          end_date: Date.new(2024, 1, 20)
        )
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        expected_ids = [transaction_s1_jan15].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_jan5.id, transaction_s1_feb10.id)
      end

      it 'filters transfers by date when include_transfers is true' do
        params = default_params.merge(
          start_date: Date.new(2024, 1, 6),
          end_date: Date.new(2024, 1, 20)
        )
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params, include_transfers: true).call

        # Should include jan15 transaction and jan10 transfer only
        expect(result.size).to eq(2)

        # Check transaction
        transactions = result.select { |r| r.transaction_type != 'transfer' }
        expect(transactions.size).to eq(1)
        expect(transactions.first.id).to eq(transaction_s1_jan15.id)

        # Check transfer
        transfers = result.select { |r| r.transaction_type == 'transfer' }
        expect(transfers.size).to eq(1)
        expect(transfers.first.id).to eq(transfer_s1_jan10.id)
      end
    end

    context 'with category filter' do
      it 'filters by category name' do
        params = default_params.merge(category_name: 'Category 1')
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        expected_ids = [transaction_s1_jan5, transaction_s1_feb10].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_jan15.id)
      end

      it 'returns no results for non-existent category' do
        params = default_params.merge(category_name: 'Non-existent Category')
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        expect(result).to be_empty
      end
    end

    context 'with amount filters' do
      it 'filters by min_amount' do
        params = default_params.merge(min_amount: 15)
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        # Should only include transactions with amount_cents >= 1500
        expect(result.map(&:id)).to contain_exactly(transaction_s1_jan15.id)
      end

      it 'filters by max_amount' do
        params = default_params.merge(max_amount: 10)
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        # Should only include transactions with amount_cents <= 1000
        expect(result.map(&:id)).to contain_exactly(transaction_s1_jan5.id, transaction_s1_feb10.id)
      end

      it 'filters transfers by amount when include_transfers is true' do
        params = default_params.merge(min_amount: 7, max_amount: 10)
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params, include_transfers: true).call

        # Should have 2 records: transaction_s1_jan5 (1000 cents = 10) and transfer_s1_feb5 (800 cents = 8)
        expect(result.size).to eq(2)

        # Verify the correct transaction is included (1000 cents = 10)
        transaction_ids = result.select { |r| r.transaction_type != 'transfer' }.map(&:id)
        expect(transaction_ids).to contain_exactly(transaction_s1_jan5.id)

        # Verify the correct transfer is included (800 cents = 8)
        transfer_ids = result.select { |r| r.transaction_type == 'transfer' }.map(&:id)
        expect(transfer_ids).to contain_exactly(transfer_s1_feb5.id)
      end
    end

    context 'with pagination' do
      let!(:additional_transactions) do
        # Create just 3 more transactions (in addition to the 3 we already have)
        3.times.map do |i|
          category = create(:category, name: "Pag Cat #{i}", space: space1)
          create(:transaction, space: space1, account: account1_s1, category:, date: Date.new(2024, 3, 1) + i.days)
        end
      end

      it 'returns the first page of results with custom per_page' do
        params = default_params.merge(
          page: 1,
          per_page: 3,
          end_date: Date.new(2024, 4, 1)
        )
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        # Should return exactly 3 transactions
        expect(result.size).to eq(3)
        # First page should have the most recent transactions (March)
        expect(result.map(&:id)).to match_array(additional_transactions.pluck(:id))
      end

      it 'returns the second page of results with custom per_page' do
        params = default_params.merge(
          page: 2,
          per_page: 3,
          end_date: Date.new(2024, 4, 1)
        )
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        # Second page should have the next 3 transactions
        expect(result.size).to eq(3)
        expect(result.map(&:id)).to match_array(first_3_transactions.map(&:id))
      end

      it 'paginates combined results when include_transfers is true' do
        params = default_params.merge(
          page: 1,
          per_page: 2,
          end_date: Date.new(2024, 4, 1)
        )
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params, include_transfers: true).call

        # Should return exactly 2 records (could be any combination of transactions and transfers)
        expect(result.size).to eq(2)

        # Get second page
        params = params.merge(page: 2)
        page2_result = described_class.new(relation: relation, params: params, include_transfers: true).call

        # Should return another 2 records
        expect(page2_result.size).to eq(2)

        # Verify no overlap between pages
        expect(page2_result.map(&:id)).not_to include(*result.map(&:id))
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
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params).call

        expected_ids = [transaction_s1_jan5].map(&:id)
        expect(result.map(&:id)).to match_array(expected_ids)
        expect(result.map(&:id)).not_to include(transaction_s1_jan15.id, transaction_s1_feb10.id)
      end

      it 'combines all filters with transfers included' do
        params = default_params.merge(
          space_code: 'space-1',
          start_date: Date.new(2024, 1, 1),
          end_date: Date.new(2024, 1, 31),
          min_amount: 10,
          max_amount: 15
        )
        relation = Transactions::Transaction.all
        result = described_class.new(relation: relation, params: params, include_transfers: true).call

        # Should include transaction_s1_jan5 (1000 cents = 10) and transfer_s1_jan10 (1200 cents = 12)
        expect(result.size).to eq(2)

        transaction_ids = result.select { |r| r.transaction_type != 'transfer' }.map(&:id)
        expect(transaction_ids).to include(transaction_s1_jan5.id)

        transfer_ids = result.select { |r| r.transaction_type == 'transfer' }.map(&:id)
        expect(transfer_ids).to include(transfer_s1_jan10.id)
      end
    end

    context 'when validation fails' do
      it 'returns validation errors for invalid space_code' do
        # We need to use the actual class method to verify validation
        query_instance = described_class.new(params: { space_code: "" })
        result = query_instance.call

        # Verify result is a hash with expected error
        expect(result).to be_a(Hash)
        expect(result).to have_key(:space_code)
        expect(result[:space_code]).to include("can't be blank")
      end

      it 'returns validation errors for non-existent space_code' do
        # We need to use the actual class method to verify validation
        query_instance = described_class.new(params: { space_code: "non-existent-space" })
        result = query_instance.call

        # Verify result is a hash with expected error
        expect(result).to be_a(Hash)
        expect(result).to have_key(:space_code)
        expect(result[:space_code]).to include("not found")
      end

      it 'returns validation errors for non-date values' do
        params = default_params.merge(start_date: 'not-a-date')
        relation = Transactions::Transaction.all
        query = described_class.new(relation: relation, params: params)

        result = query.call
        expect(result).to be_a(Hash)
        expect(result).to have_key(:start_date)
      end

      it 'returns validation errors for non-integer page' do
        params = default_params.merge(page: 'first')
        relation = Transactions::Transaction.all
        query = described_class.new(relation: relation, params: params)

        result = query.call
        expect(result).to be_a(Hash)
        expect(result).to have_key(:page)
      end
    end
  end
end
