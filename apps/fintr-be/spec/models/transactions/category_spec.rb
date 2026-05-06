# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Category, type: :model do
  # No top-level subject needed if not used by all validation tests
  let(:space) { create(:space) } # Assumes :space factory creates Spaces::Space

  describe 'table name' do
    it { expect(described_class.table_name).to eq('transactions_categories') }
  end

  describe 'associations' do
    it { is_expected.to belong_to(:space).class_name('Spaces::Space') }
  end

  describe 'enums' do
    it do
      # Test on a built instance
      category = build(:category)
      expect(category).to define_enum_for(:category_type)
        .with_values(income: "income", expense: "expense")
        .backed_by_column_of_type(:enum)
    end
  end

  describe 'validations' do
    subject(:category) { build(:category, space: space) } # Use build for presence test

    it { is_expected.to validate_presence_of(:name) }

    describe 'name uniqueness to space_id and category_type' do
      let!(:existing_category) { create(:category, space: space, category_type: :income, name: 'Income Cat') }

      it 'is valid with a unique name for the space and category type' do
        expect(category).to be_valid
      end

      it 'is invalid with a duplicate name for the same space and category type' do
        category.name = existing_category.name
        expect(category).to be_invalid
        expect(category.errors[:name]).to include("already exists for this space and type")
      end

      it 'is valid with a duplicate name for a different space' do
        other_space = create(:space)
        _other_category = create(:category, space: other_space, category_type: :income, name: 'Income Cat')
        expect(category).to be_valid
      end

      it 'is valid with a duplicate name for a different category type' do
        _other_category = create(:category, space: space, category_type: :expense, name: 'Income Cat')
        expect(category).to be_valid
      end
    end
  end

  describe 'scopes' do
    # Create categories explicitly for this context
    let!(:income_category) { create(:category, space: space, category_type: :income, name: 'Income Cat') }
    let!(:expense_category) { create(:category, space: space, category_type: :expense, name: 'Expense Cat') }
    # Create another space and category to ensure scoping works
    let(:other_space) { create(:space) }
    let!(:other_space_category) { create(:category, space: other_space, category_type: :income, name: 'Other Income') }

    before do
      allow_any_instance_of(Spaces::Space).to receive(:create_default_transaction_categories).and_return(true)
    end

    describe '.income' do
      it 'returns only income categories for the specific space' do
        # Query only within the specific space
        expect(described_class.where(space: space).income).to include(income_category)
        expect(described_class.where(space: space).income).not_to include(other_space_category)
      end
    end

    describe '.expense' do
      it 'returns only expense categories for the specific space' do
        expect(described_class.where(space: space).expense).to include(expense_category)
        expect(described_class.where(space: space).expense).not_to include(other_space_category)
      end
    end
  end

  describe '.transfer_fee' do
    let!(:transfer_fee_category) { create(:category, space: space, category_type: :expense, name: "Transfer Fee") }

    it 'returns the Transfer Fee category' do
      expect(described_class.transfer_fee).to eq(transfer_fee_category)
    end

    it 'returns nil when no Transfer Fee category exists' do
      transfer_fee_category.destroy
      expect(described_class.transfer_fee).to be_nil
    end
  end

  describe '.create_default_categories' do
    # Build space without running callbacks to isolate the class method
    let(:new_space) { build(:space) }
    let(:default_income_count) { Transactions::Category::DEFAULT_INCOME_CATEGORIES.count } # Adjusted: Count only normally selectable income categories
    let(:default_expense_count) { Transactions::Category::DEFAULT_EXPENSE_CATEGORIES.count } # Adjusted: Count only normally selectable expense categories. "Transfer" is also special.

    before do
      # Save the space without triggering the after_create callback
      new_space.save(validate: false)
      new_space.categories.destroy_all
    end

    it 'creates the correct number of default income categories (excluding special ones) for the space via income scope' do
      expect {
        described_class.create_default_categories(new_space)
      }.to change { new_space.categories.income.count }.by(default_income_count)
    end


    it 'creates categories with the correct names and types, including special categories' do
      described_class.create_default_categories(new_space)
      new_space.reload # Reload to see the created categories

      income_names = new_space.categories.where(category_type: :income).pluck(:name) # Query all income, then check subsets
      expense_names = new_space.categories.where(category_type: :expense).pluck(:name) # Query all expense

      # Check for user-selectable categories
      expect(income_names).to include(*Transactions::Category::DEFAULT_INCOME_CATEGORIES)

      # Check for special internal categories
      expect(income_names).to include("Initial Balance", "Income Adjustment")
      expect(expense_names).to include("Transfer Fee", "Expense Adjustment")

      # Ensure default categories are created
      expect(income_names).to include(*Transactions::Category::DEFAULT_INCOME_CATEGORIES)
      expect(expense_names).to include(*Transactions::Category::DEFAULT_EXPENSE_CATEGORIES)
    end

    it 'is idempotent (does not create duplicates or raise errors on second run)' do
      described_class.create_default_categories(new_space) # First run
      expect {
        described_class.create_default_categories(new_space) # Second run
      }.not_to change { new_space.categories.count }
      # We also expect no exception to be raised due to the rescue block
      expect { described_class.create_default_categories(new_space) }.not_to raise_error
    end
  end
end
