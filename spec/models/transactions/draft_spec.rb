# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Draft, type: :model do
  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:account) { create(:account, space: space) }
  let(:category) { create(:category, space: space) }

  let(:draft_transaction) do
    build(
      :draft_transaction,
      user: user,
      space: space,
      account: account,
      category: category,
      date: Time.zone.today,
      amount: 100.00,
      amount_currency: 'PHP',
      balance: 100.00,
      balance_currency: 'PHP'
    )
  end

  describe 'associations' do
    it { is_expected.to belong_to(:user).class_name("Auth::User") }
    it { is_expected.to belong_to(:space).class_name("Spaces::Space") }
    it { is_expected.to belong_to(:category).class_name("Transactions::Category") }
    it { is_expected.to belong_to(:account).class_name("Transactions::Account") }
    it { is_expected.to belong_to(:parent).class_name("Transactions::Transaction").optional }
    it { is_expected.to have_many(:children).class_name("Transactions::Transaction").with_foreign_key(:parent_id) }
  end

  describe 'inheritance' do
    it 'is a type of Transaction' do
      expect(described_class).to be < Transactions::Transaction
    end

    it 'can be created with the correct type' do
      expect(draft_transaction).to be_a(described_class)
      expect(draft_transaction.type).to eq(described_class.name)
    end
  end

  describe 'constants' do
    it 'defines MAX_DRAFTS constant' do
      expect(described_class::MAX_DRAFTS).to eq(5)
    end
  end

  describe 'validations' do
    it 'inherits validations from Transaction' do
      expect(draft_transaction).to be_valid
    end

    it 'requires date' do
      draft_transaction.date = nil
      expect(draft_transaction).not_to be_valid
      expect(draft_transaction.errors[:date]).to include("can't be blank")
    end

    it 'requires amount_cents' do
      draft_transaction.amount_cents = nil
      expect(draft_transaction).not_to be_valid
      expect(draft_transaction.errors[:amount_cents]).to include("can't be blank")
    end

    it 'requires balance_cents' do
      draft_transaction.balance_cents = nil
      expect(draft_transaction).not_to be_valid
      expect(draft_transaction.errors[:balance_cents]).to include("can't be blank")
    end

    it 'requires type' do
      draft_transaction.type = nil
      expect(draft_transaction).not_to be_valid
      expect(draft_transaction.errors[:type]).to include("can't be blank")
    end
  end

  describe 'scopes' do
    let!(:draft1) { create(:draft_transaction, created_at: 2.days.ago) }
    let!(:draft2) { create(:draft_transaction, created_at: 1.day.ago) }
    let!(:draft3) { create(:draft_transaction, created_at: Time.current) }

    describe '.ordered' do
      it 'returns drafts ordered by created_at in descending order' do
        ordered_drafts = described_class.ordered
        expect(ordered_drafts.to_a).to eq([draft3, draft2, draft1])
      end
    end
  end

  describe '#income' do
    it 'returns 0' do
      expect(draft_transaction.income).to eq(0)
    end
  end

  describe '#expense' do
    it 'returns 0' do
      expect(draft_transaction.expense).to eq(0)
    end
  end
end
