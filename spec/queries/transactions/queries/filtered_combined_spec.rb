# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Queries::FilteredCombined, type: :query do
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
  let!(:income_s1_jan5) { create(:income_transaction, space: space1, account: account1_s1, category: category1_s1, date: Date.new(2024, 1, 5), amount_cents: 1000) }
  let!(:expense_s1_jan15) { create(:expense_transaction, space: space1, account: account2_s1, category: category2_s1, date: Date.new(2024, 1, 15), amount_cents: 2000) }

  # Transfers in Space 1 - Note: Transfer doesn't have a category attribute
  let!(:transfer_s1_feb10) do
    create(
      :transfer,
      space: space1,
      from_account: account1_s1,
      to_account: account2_s1,
      date: Date.new(2024, 2, 10),
      amount_cents: 500
    )
  end

  # Transactions in Space 2
  let!(:income_s2_jan20) { create(:income_transaction, space: space2, account: account1_s2, category: category1_s2, date: Date.new(2024, 1, 20), amount_cents: 3000) }
  let!(:expense_s2_feb5) { create(:expense_transaction, space: space2, account: account1_s2, category: category1_s2, date: Date.new(2024, 2, 5), amount_cents: 1500) }

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
    context 'when validation fails' do
      it 'returns a failure for invalid space_code' do
        params = default_params.merge(space_code: 'non-existent')
        result = described_class.new(params: params).call

        expect(result).to be_failure
        expect(result.failure).to include(:space_code)
      end

      it 'returns a failure for invalid min/max amount' do
        params = default_params.merge(min_amount: 100, max_amount: 10)
        result = described_class.new(params: params).call

        expect(result).to be_failure
        expect(result.failure[:min_amount]).to include("should be less than max_amount")
      end
    end

    context 'with mocked queries' do
      let(:mock_relation) { double("ActiveRecord::Relation") } # rubocop:disable RSpec/VerifiedDoubles

      before do
        # Set up expectations for common method chains
        allow(Transactions::Combined).to receive(:all).and_return(mock_relation)
        allow(mock_relation).to receive(:joins).and_return(mock_relation)
        allow(mock_relation).to receive(:where).and_return(mock_relation)
        allow(mock_relation).to receive(:order).and_return(mock_relation)
        allow(mock_relation).to receive(:page).and_return(mock_relation)
        allow(mock_relation).to receive(:per).and_return(mock_relation)
      end

      it 'calls joins with the correct tables' do
        # Verify the join query
        expect(mock_relation).to receive(:joins).with(
          "INNER JOIN spaces ON spaces.id = combined_transactions.space_id",
          "INNER JOIN transactions_categories ON transactions_categories.id = combined_transactions.category_id",
          "INNER JOIN accounts as to_accounts ON to_accounts.id = combined_transactions.to_account_id",
          "INNER JOIN accounts as from_accounts ON from_accounts.id = combined_transactions.from_account_id"
        ).and_return(mock_relation) # rubocop:disable RSpec/MessageSpies

        described_class.new(relation: mock_relation, params: default_params).call
      end

      it 'calls where with the correct space conditions' do
        # Allow the space to be found
        allow(Spaces::Space).to receive(:find_by).with(code: 'space-1').and_return(space1)

        # Verify the space filtering
        expect(mock_relation).to receive(:where).with(space: space1).and_return(mock_relation)# rubocop:disable RSpec/MessageSpies

        described_class.new(relation: mock_relation, params: default_params).call
      end

      it 'calls where with the correct date range conditions' do
        allow(Spaces::Space).to receive(:find_by).with(code: 'space-1').and_return(space1)

        # Verify date filtering - note that the implementation uses a Range object
        expect(mock_relation).to receive(:where).with(date: Date.new(2024, 1, 1)..Date.new(2024, 2, 28)) # rubocop:disable RSpec/MessageSpies
          .and_return(mock_relation)

        described_class.new(relation: mock_relation, params: default_params).call
      end

      it 'calls where with the correct category condition' do
        allow(Spaces::Space).to receive(:find_by).with(code: 'space-1').and_return(space1)

        # Test category filtering
        params = default_params.merge(category_name: 'Category 1')
        expect(mock_relation).to receive(:where).with(transactions_categories: { name: 'Category 1' }) # rubocop:disable RSpec/MessageSpies
          .and_return(mock_relation)

        described_class.new(relation: mock_relation, params: params).call
      end

      it 'calls order with the correct ordering' do
        allow(Spaces::Space).to receive(:find_by).with(code: 'space-1').and_return(space1)

        # Verify ordering
        expect(mock_relation).to receive(:order).with(
          date: :desc,
          transactable_type: :desc,
          amount_cents: :desc
        ).and_return(mock_relation) # rubocop:disable RSpec/MessageSpies

        described_class.new(relation: mock_relation, params: default_params).call
      end

      it 'paginates with the correct parameters' do
        allow(Spaces::Space).to receive(:find_by).with(code: 'space-1').and_return(space1)

        # Verify pagination
        expect(mock_relation).to receive(:page).with(1).and_return(mock_relation) # rubocop:disable RSpec/MessageSpies
        expect(mock_relation).to receive(:per).with(25).and_return(mock_relation) # rubocop:disable RSpec/MessageSpies

        described_class.new(relation: mock_relation, params: default_params).call
      end

      it 'paginates with custom per_page' do
        allow(Spaces::Space).to receive(:find_by).with(code: 'space-1').and_return(space1)

        # Verify custom pagination
        params = default_params.merge(per_page: 10)
        expect(mock_relation).to receive(:page).with(1).and_return(mock_relation) # rubocop:disable RSpec/MessageSpies
        expect(mock_relation).to receive(:per).with(10).and_return(mock_relation) # rubocop:disable RSpec/MessageSpies

        described_class.new(relation: mock_relation, params: params).call
      end

      it 'calls where with the correct amount conditions for min_amount' do
        allow(Spaces::Space).to receive(:find_by).with(code: 'space-1').and_return(space1)

        # Test min_amount filtering - using exclusive range with lower bound
        params = default_params.merge(min_amount: 15)
        expect(mock_relation).to receive(:where).with(amount_cents: 1500...Float::INFINITY) # rubocop:disable RSpec/MessageSpies
          .and_return(mock_relation)

        described_class.new(relation: mock_relation, params: params).call
      end

      it 'calls where with the correct amount conditions for max_amount' do
        allow(Spaces::Space).to receive(:find_by).with(code: 'space-1').and_return(space1)

        # Test max_amount filtering - using exclusive range with upper bound
        params = default_params.merge(max_amount: 10)
        expect(mock_relation).to receive(:where).with(amount_cents: 0...1000) # rubocop:disable RSpec/MessageSpies
          .and_return(mock_relation)

        described_class.new(relation: mock_relation, params: params).call
      end

      it 'calls where with the correct amount conditions for both min and max' do
        allow(Spaces::Space).to receive(:find_by).with(code: 'space-1').and_return(space1)

        # Test both min and max filtering - using exclusive range with both bounds
        params = default_params.merge(min_amount: 5, max_amount: 10)
        expect(mock_relation).to receive(:where).with(amount_cents: 500...1000) # rubocop:disable RSpec/MessageSpies
          .and_return(mock_relation)

        described_class.new(relation: mock_relation, params: params).call
      end
    end
  end
end
