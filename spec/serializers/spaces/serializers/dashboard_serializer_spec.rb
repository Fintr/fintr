# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spaces::Serializers::DashboardSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(space) }

  let!(:space) { create(:space) } # Using let! to ensure it's created before associations

  # Setup associated data
  let!(:expense_cat1) { create(:category, space: space, name: "Groceries", category_type: :expense) }
  let!(:expense_cat2) { create(:category, space: space, name: "Utilities", category_type: :expense) }
  let!(:income_cat1) { create(:category, space: space, name: "Salary", category_type: :income) }

  let!(:account1) { create(:account, space: space, name: "Checking Account") }
  let!(:account2) { create(:account, space: space, name: "Savings Account") }

  it 'includes the id' do
    expect(serialized_hash[:id]).to eq(space.id)
  end

  describe ':category_options field' do
    let(:expected_options) do
      [expense_cat1, expense_cat2, income_cat1].map do |category|
        { label: category.name, value: category.name }
      end.sort_by { |h| h[:label] } # Sort for consistent comparison
    end

    it 'includes all valid categories as label-value pairs' do
      # The serializer does not specify an order, so we sort both for comparison
      actual_options = serialized_hash[:category_options].sort_by { |h| h[:label] }
      expect(actual_options).to match_array(expected_options)
    end
  end

  describe ':expense_category_options field' do
    let(:expected_options) do
      [expense_cat1, expense_cat2].map do |category|
        { label: category.name, value: category.name }
      end.sort_by { |h| h[:label] }
    end

    it 'includes only expense categories as label-value pairs' do
      actual_options = serialized_hash[:expense_category_options].sort_by { |h| h[:label] }
      expect(actual_options).to match_array(expected_options)
    end
  end

  describe ':income_category_options field' do
    let(:expected_options) do
      [income_cat1].map do |category|
        { label: category.name, value: category.name }
      end.sort_by { |h| h[:label] }
    end

    it 'includes only income categories as label-value pairs' do
      actual_options = serialized_hash[:income_category_options].sort_by { |h| h[:label] }
      expect(actual_options).to match_array(expected_options)
    end
  end

  describe ':account_options field' do
    let(:expected_options) do
      [account1, account2].map do |account|
        { label: account.name, value: account.name }
      end.sort_by { |h| h[:label] }
    end

    it 'includes all accounts as label-value pairs' do
      actual_options = serialized_hash[:account_options].sort_by { |h| h[:label] }
      expect(actual_options).to match_array(expected_options)
    end
  end

  it 'serializes all expected top-level fields' do
    expected_keys = [
      :id,
      :category_options,
      :expense_category_options,
      :income_category_options,
      :account_options,
      :goal_description
    ]
    expect(serialized_hash.keys).to match_array(expected_keys)
  end

  context 'when a space has no associated items' do
    subject(:empty_serialized_hash) { described_class.render_as_hash(empty_space) }

    let!(:empty_space) { create(:space) }


    it 'returns empty arrays for options fields' do
      expect(empty_serialized_hash[:category_options]).to be_empty
      expect(empty_serialized_hash[:expense_category_options]).to be_empty
      expect(empty_serialized_hash[:income_category_options]).to be_empty
      expect(empty_serialized_hash[:account_options]).to be_empty
    end

    it 'still includes the id' do
      expect(empty_serialized_hash[:id]).to eq(empty_space.id)
    end
  end
end
