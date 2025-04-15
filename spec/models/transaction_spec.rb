# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transaction, type: :model do
  describe 'associations' do
    it { is_expected.to belong_to(:user) }
  end

  describe 'validations' do
    it { is_expected.to validate_presence_of(:date) }
    it { is_expected.to validate_presence_of(:amount_cents) }
    it { is_expected.to validate_presence_of(:balance_cents) }
    it { is_expected.to validate_presence_of(:type) }

    it { is_expected.to validate_numericality_of(:amount).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_numericality_of(:balance).is_greater_than_or_equal_to(0) }

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
end
