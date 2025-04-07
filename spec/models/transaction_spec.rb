# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transaction, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:user) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:date) }
    it { is_expected.to validate_presence_of(:amount) }
    it { is_expected.to validate_presence_of(:balance) }
    it { is_expected.to validate_presence_of(:transaction_type) }

    it { is_expected.to validate_numericality_of(:amount).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_numericality_of(:balance).is_greater_than_or_equal_to(0) }

    context 'when transaction_type is expense' do
      subject { build(:transaction, transaction_type: 'expense', expense_category: 'food', income_category: 'salary') }

      it { is_expected.to validate_presence_of(:expense_category) }
    end

    context 'when transaction_type is income' do
      subject { build(:transaction, transaction_type: 'income', income_category: 'salary', expense_category: 'food') }

      it { is_expected.to validate_presence_of(:income_category) }
    end

    context 'when amount is negative' do
      let(:transaction) { build(:transaction, amount: -10) }

      it 'is invalid' do
        expect(transaction).not_to be_valid
        expect(transaction.errors[:amount]).to include('must be greater than or equal to 0')
      end
    end

    context 'when balance is negative' do
      let(:transaction) { build(:transaction, balance: -10) }

      it 'is invalid' do
        expect(transaction).not_to be_valid
        expect(transaction.errors[:balance]).to include('must be greater than or equal to 0')
      end
    end
  end

  describe 'enums' do
    # PostgreSQL native enum types require different testing approach
    # Test the class enum definitions and instance methods

    describe 'transaction_type enum' do
      it 'defines the expected values' do
        expect(described_class.transaction_types).to eq({ "income"=>"income", "expense"=>"expense" })
      end

      it 'provides predicate methods' do
        transaction = described_class.new(transaction_type: 'income', expense_category: 'food', income_category: 'salary')
        expect(transaction.income?).to be true
        expect(transaction.expense?).to be false
      end
    end

    describe 'expense_category enum' do
      it 'defines the expected values' do
        expected_categories = {
          "house" => "house",
          "food" => "food",
          "transportation" => "transportation",
          "utilities" => "utilities",
          "insurance" => "insurance",
          "family" => "family",
          "pet" => "pet",
          "socials" => "socials",
          "entertainment" => "entertainment",
          "travel" => "travel",
          "business" => "business"
        }
        expect(described_class.expense_categories).to eq(expected_categories)
      end

      it 'provides predicate methods' do
        transaction = described_class.new(expense_category: 'food')
        expect(transaction.food?).to be true
        expect(transaction.transportation?).to be false
      end
    end

    describe 'income_category enum' do
      it 'defines the expected values' do
        expected_categories = {
          "salary" => "salary",
          "freelance" => "freelance",
          "business" => "business"
        }
        expect(described_class.income_categories).to eq(expected_categories)
      end

      it 'provides predicate methods' do
        transaction = described_class.new(income_category: 'salary')
        expect(transaction.salary?).to be true
        expect(transaction.freelance?).to be false
      end
    end

    describe 'essentialness enum' do
      it 'defines the expected values' do
        expect(described_class.essentialnesses).to eq({ "want"=>"want", "need"=>"need" })
      end

      it 'provides predicate methods' do
        transaction = described_class.new(essentialness: 'need')
        expect(transaction.need?).to be true
        expect(transaction.want?).to be false
      end
    end
  end

  describe 'callbacks' do
    describe '#clear_inappropriate_category' do
      context 'when transaction is an expense' do
        let(:transaction) do
          create(:transaction,
                 transaction_type: 'expense',
                 expense_category: 'food',
                 income_category: 'salary')  # Both categories set initially
        end

        it 'clears the income_category on save' do
          transaction.save
          expect(transaction.reload.income_category).to be_nil
          expect(transaction.expense_category).to eq('food')
        end
      end

      context 'when transaction is an income' do
        let(:transaction) do
          create(:transaction,
                 transaction_type: 'income',
                 income_category: 'salary',
                 expense_category: 'food')  # Both categories set initially
        end

        it 'clears the expense_category on save' do
          transaction.save
          expect(transaction.reload.expense_category).to be_nil
          expect(transaction.income_category).to eq('salary')
        end
      end

      context 'when changing transaction type' do
        let(:transaction) { create(:transaction, transaction_type: 'income', income_category: 'salary') }

        it 'updates categories correctly when changing from income to expense' do
          # Re-set income category to ensure it's present
          transaction.income_category = 'salary'
          # Change to expense
          transaction.transaction_type = 'expense'
          transaction.expense_category = 'food'
          transaction.save

          expect(transaction.reload.income_category).to be_nil
          expect(transaction.expense_category).to eq('food')
        end
      end
    end

    describe '#set_essentialness' do
      context 'when expense category is a need' do
        Transaction::NEED_CATEGORIES.each do |category|
          it "sets essentialness to 'need' for #{category} category" do
            transaction = build(:transaction, transaction_type: 'expense', expense_category: category)
            transaction.valid?
            expect(transaction.essentialness).to eq('need')
          end
        end
      end

      context 'when expense category is a want' do
        Transaction::WANT_CATEGORIES.each do |category|
          it "sets essentialness to 'want' for #{category} category" do
            transaction = build(:transaction, transaction_type: 'expense', expense_category: category)
            transaction.valid?
            expect(transaction.essentialness).to eq('want')
          end
        end
      end
    end
  end
end
