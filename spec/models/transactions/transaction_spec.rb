# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Transaction, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:user).class_name("Auth::User") }
    it { is_expected.to belong_to(:space).class_name("Spaces::Space") }
    it { is_expected.to belong_to(:category).class_name("Transactions::Category") }
    it { is_expected.to belong_to(:account).class_name("Transactions::Account") }
    it { is_expected.to belong_to(:parent).class_name("Transactions::Transaction").optional }
    it { is_expected.to belong_to(:effective_parent).class_name("Transactions::Transaction").optional }
    it { is_expected.to belong_to(:transfer).class_name("Transactions::Transfer").optional }
    it { is_expected.to have_one(:loan_payment).class_name("Transactions::LoanPayment").with_foreign_key(:transaction_id).dependent(:nullify) }
    it { is_expected.to have_many(:children).class_name("Transactions::Transaction").with_foreign_key(:parent_id) }
    it { is_expected.to have_many(:effective_children).class_name("Transactions::Transaction").with_foreign_key(:effective_parent_id) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:date) }
    it { is_expected.to validate_presence_of(:amount_cents) }
    it { is_expected.to validate_presence_of(:balance_cents) }
    it { is_expected.to validate_presence_of(:type) }

    it { is_expected.to validate_numericality_of(:amount_cents).is_greater_than_or_equal_to(0) }

    context 'when amount is negative' do
      let(:transaction) { build(:transaction, amount: -10) }

      it 'is invalid' do
        expect(transaction).not_to be_valid
        expect(transaction.errors[:amount_cents]).to include('must be greater than or equal to 0')
      end
    end

    context 'when balance is negative' do
      let(:transaction) { build(:transaction, balance: -10) }

      it 'is invalid' do
        expect(transaction).to be_valid
      end
    end
  end

  describe 'scopes' do
    describe '.calculated' do
      let!(:calculated_transaction) { create(:transaction, balance_state: :calculated) }
      let!(:pending_transaction) { create(:transaction, balance_state: :pending) }

      it 'returns transactions with calculated balance_state' do
        expect(described_class.calculated).to include(calculated_transaction)
        expect(described_class.calculated).not_to include(pending_transaction)
      end
    end

    describe '.pending' do
      let!(:calculated_transaction) { create(:transaction, balance_state: :calculated) }
      let!(:pending_transaction) { create(:transaction, balance_state: :pending) }

      it 'returns transactions with pending balance_state' do
        expect(described_class.pending).to include(pending_transaction)
        expect(described_class.pending).not_to include(calculated_transaction)
      end
    end

    describe '.non_draft' do
      let!(:draft_transaction) { create(:transaction, type: "Transactions::Draft") }
      let!(:regular_transaction) { create(:transaction, type: "Transactions::Income") }

      it 'returns transactions that are not drafts' do
        expect(described_class.non_draft).to include(regular_transaction)
        expect(described_class.non_draft).not_to include(draft_transaction)
      end
    end

    describe '.ordered' do
      let!(:space) { create(:space) }
      let!(:older_transaction) { create(:income_transaction, date: 2.days.ago, created_at: 1.minute.ago, space: space) }
      let!(:newer_transaction) { create(:income_transaction, date: 1.day.ago, space: space) }

      it 'orders transactions by date in ascending order by default' do
        ordered_transactions = described_class.where(space: space).ordered
        expect(ordered_transactions.first).to eq(older_transaction)
        expect(ordered_transactions.last).to eq(newer_transaction)
      end

      it 'orders transactions by date in descending order when specified' do
        ordered_transactions = described_class.where(space: space).ordered(direction: :desc)
        expect(ordered_transactions.first).to eq(newer_transaction)
        expect(ordered_transactions.last).to eq(older_transaction)
      end
    end
  end

  describe 'enums' do
    it 'defines balance_state as an enum with string values' do
      expect(described_class.balance_states).to eq(
        "pending" => "pending",
        "calculated" => "calculated"
      )
    end
  end

  describe '#value' do
    let(:transaction) { build(:transaction, amount: 100) }

    it 'returns the amount' do
      expect(transaction.value).to eq(Money.from_amount(100, 'PHP'))
    end
  end
end
