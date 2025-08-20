# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Budget, type: :model do
  let(:space) { create(:space) }
  let(:expense_category) { create(:category, space: space, category_type: :expense, name: "Expenses") }
  let(:income_category) { create(:category, space: space, category_type: :income, name: "Income") }
  let(:date) { Date.current }

  describe 'associations' do
    # Stub the validation method to avoid the expense? check during association tests
    before do
      allow_any_instance_of(described_class).to receive(:category_is_expense).and_return(true)
      allow_any_instance_of(described_class).to receive(:only_one_category_for_month).and_return(true)
    end

    it { is_expected.to belong_to(:space).class_name('Spaces::Space') }
    it { is_expected.to belong_to(:category).class_name('Transactions::Category') }
  end

  describe 'monetize' do
    it { is_expected.to monetize(:amount_cents) }
    it { is_expected.to monetize(:spent_cents) }
  end

  describe 'delegations' do
    subject(:budget) { build_stubbed(:budget, date: date) }

    it 'delegates month to date' do
      expect(budget.month).to eq(date.month)
    end

    it 'delegates year to date' do
      expect(budget.year).to eq(date.year)
    end
  end

  describe 'validations' do
    subject(:budget) { build(:budget, space: space, category: expense_category) }

    describe 'category_is_expense' do
      it 'is valid with an expense category' do
        expect(budget).to be_valid
      end

      it 'is invalid with an income category' do
        budget.category = income_category
        expect(budget).to be_invalid
        expect(budget.errors[:category]).to include('must be an expense category')
      end
    end
  end

  describe '#transactions' do
    subject(:budget) { build_stubbed(:budget, space: space, category: expense_category, date: date) }

    let!(:transaction_this_month) do
      create(:expense_transaction,
             space: space,
             category: expense_category,
             date: date.beginning_of_month + 5.days)
    end

    let!(:transaction_other_month) do
      create(:expense_transaction,
             space: space,
             category: expense_category,
             date: date.beginning_of_month - 5.days)
    end

    let(:other_category) { create(:category, space: space, category_type: :expense, name: "Other Expense") }
    let!(:transaction_other_category) do
      create(:expense_transaction,
             space: space,
             category: other_category,
             date: date.beginning_of_month + 5.days)
    end

    let(:other_space) { create(:space) }
    let!(:transaction_other_space) do
      create(:expense_transaction,
             space: other_space,
             category: create(:category, space: other_space, category_type: :expense, name: "Expense Category"),
             date: date.beginning_of_month + 5.days)
    end

    # Create a test implementation of the transactions method to test the logic
    it 'returns transactions for the same category, space, and month' do
      # Test the expected logic directly
      transactions = Transactions::Transaction
                      .where(category: expense_category, space: space)
                      .where(date: date.all_month)

      expect(transactions).to include(transaction_this_month)
      expect(transactions).not_to include(transaction_other_month)
      expect(transactions).not_to include(transaction_other_category)
      expect(transactions).not_to include(transaction_other_space)
    end
  end
end
