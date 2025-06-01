# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Transaction, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:user).class_name("Auth::User") }
    it { is_expected.to belong_to(:space).class_name("Spaces::Space") }
    it { is_expected.to belong_to(:category).class_name("Transactions::Category") }
    it { is_expected.to belong_to(:account).class_name("Transactions::Account") }
    it { is_expected.to belong_to(:parent).class_name("Transactions::Transaction").optional }
    it { is_expected.to have_many(:children).class_name("Transactions::Transaction").with_foreign_key(:parent_id) }
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
    let!(:calculated_transaction) { create(:transaction, balance_state: :calculated) }
    let!(:pending_transaction) { create(:transaction, balance_state: :pending) }

    describe '.calculated' do
      it 'returns transactions with calculated balance_state' do
        expect(described_class.calculated).to include(calculated_transaction)
        expect(described_class.calculated).not_to include(pending_transaction)
      end
    end

    describe '.pending' do
      it 'returns transactions with pending balance_state' do
        expect(described_class.pending).to include(pending_transaction)
        expect(described_class.pending).not_to include(calculated_transaction)
      end
    end
  end
end
