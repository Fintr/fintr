# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Account, type: :model do
  describe 'associations' do
    subject { create(:account, space: space) }

    let(:space) { create(:space) }


    it { is_expected.to belong_to(:space).class_name('Spaces::Space') }
    it { is_expected.to have_many(:transactions).dependent(:destroy) }
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

    it 'validates numericality of balance_cents >= 0' do
      account = build(:account, balance_cents: -1, space: space)
      expect(account).not_to be_valid
      account.balance_cents = 0
      expect(account).to be_valid
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

  describe 'scopes' do
    describe '.default' do
      let(:space) { create(:space) }
      let!(:custom_account) { create(:account, name: 'My Custom Account', space: space) }
      let(:another_space) { create(:space) }
      let!(:custom_account_in_another_space) { create(:account, name: 'My Custom Account', space: another_space) }

      before do
        described_class.create_default_accounts(space)
      end

      it 'returns only accounts with default names within the specific space' do
        default_account_names = Transactions::Account::DEFAULT_ACCOUNT_NAMES
        expect(described_class.where(space: space).default.pluck(:name)).to match_array(default_account_names)
        expect(described_class.where(space: space).default).not_to include(custom_account)
        expect(described_class.where(space: another_space).default).not_to include(custom_account_in_another_space)
      end
    end
  end

  describe '.create_default_accounts' do
    let(:space) { create(:space) }
    let(:all_default_names) { Transactions::Account::DEFAULT_ACCOUNT_NAMES }

    it 'creates accounts with default names for the given space' do
      expect do
        described_class.create_default_accounts(space)
      end.to change { described_class.where(space: space).count }.by(all_default_names.count)

      default_names_in_db = described_class.where(space: space).pluck(:name)
      expect(default_names_in_db).to match_array(all_default_names)
    end

    it 'does not create duplicate accounts if they already exist' do
      # Create one default account beforehand in the specific space
      create(:account, name: Transactions::Account::DEFAULT_ACCOUNT_NAMES.first, space: space)

      expect do
        described_class.create_default_accounts(space)
      end.to change { described_class.where(space: space).count }.by(all_default_names.count - 1)
    end

    it 'does not create accounts for a different space' do
       other_space = create(:space)
       expect do
         described_class.create_default_accounts(space)
       end.not_to change { described_class.where(space: other_space).count }
    end
  end
end
