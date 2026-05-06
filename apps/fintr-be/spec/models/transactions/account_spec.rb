# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Account, type: :model do
  describe 'associations' do
    subject { create(:account, space: space) }

    let(:space) { create(:space) }


    it { is_expected.to belong_to(:space).class_name('Spaces::Space') }
    it { is_expected.to have_many(:transactions) }
  end

  describe 'validations' do
    let(:space) { create(:space) }

    it 'validates presence of name' do
      account = build(:account, name: nil, space: space)
      expect(account).not_to be_valid
    end

    it 'validates presence of balance_cents' do
       account = build(:account, balance_cents: nil, space: space)
       expect(account).not_to be_valid
    end

    it 'validates presence of balance_currency' do
      account = build(:account, balance_currency: nil, space: space)
      expect(account).not_to be_valid
    end

    it 'validates uniqueness of name scoped to space_id' do
       create(:account, name: 'unique_name', space: space)
       account2 = build(:account, name: 'unique_name', space: space)
       expect(account2).not_to be_valid
       expect(account2.errors[:name]).to include('has already been taken')

       # Should be valid in a different space
       other_space = create(:space)
       account3 = build(:account, name: 'unique_name', space: other_space)
       expect(account3).to be_valid
    end
  end
end
