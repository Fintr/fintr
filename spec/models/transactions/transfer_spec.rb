# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Transfer, type: :model do
  describe 'associations' do
    # For association tests, we'll check the reflections directly instead of using shoulda matchers
    # This avoids issues with validation callbacks
    it 'belongs to user as Auth::User' do
      association = described_class.reflect_on_association(:user)
      expect(association.macro).to eq :belongs_to
      expect(association.options[:class_name]).to eq 'Auth::User'
    end

    it 'belongs to space as Spaces::Space' do
      association = described_class.reflect_on_association(:space)
      expect(association.macro).to eq :belongs_to
      expect(association.options[:class_name]).to eq 'Spaces::Space'
    end

    it 'belongs to from_account as Transactions::Account' do
      association = described_class.reflect_on_association(:from_account)
      expect(association.macro).to eq :belongs_to
      expect(association.options[:class_name]).to eq 'Transactions::Account'
    end

    it 'belongs to to_account as Transactions::Account' do
      association = described_class.reflect_on_association(:to_account)
      expect(association.macro).to eq :belongs_to
      expect(association.options[:class_name]).to eq 'Transactions::Account'
    end

    it 'belongs to parent as Transactions::Transfer (optional)' do
      association = described_class.reflect_on_association(:parent)
      expect(association.macro).to eq :belongs_to
      expect(association.options[:class_name]).to eq 'Transactions::Transfer'
      expect(association.options[:optional]).to be true
    end

    it 'has many children as Transactions::Transfer with foreign key parent_id' do
      association = described_class.reflect_on_association(:children)
      expect(association.macro).to eq :has_many
      expect(association.options[:class_name]).to eq 'Transactions::Transfer'
      expect(association.options[:foreign_key]).to eq :parent_id
    end
  end

  describe 'validations' do
    subject(:transfer) do
      build(
        :transfer,
        user:,
        space:,
        from_account:,
        to_account:,
        amount: 100,
        amount_currency: 'PHP',
        transaction_cost: 5,
        transaction_cost_currency: 'PHP',
        balance_state: 'pending'
      )
    end

    let(:space) { create(:personal_space) }
    let(:from_account) { create(:account, space:, balance_currency: 'PHP') }
    let(:to_account) { create(:account, space:, balance_currency: 'PHP') }
    let(:user) { create(:user) }


    it { is_expected.to validate_presence_of(:date) }
    it { is_expected.to validate_presence_of(:amount_cents) }
    it { is_expected.to validate_numericality_of(:amount_cents).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:transaction_cost_cents) }
    it { is_expected.to validate_numericality_of(:transaction_cost_cents).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:balance_state) }
    it { is_expected.to validate_inclusion_of(:balance_state).in_array(Transactions::Transaction.balance_states.values) }

    context 'with accounts from different spaces' do
      let(:other_space) { create(:personal_space) }
      let(:to_account) { create(:account, space: other_space, balance_currency: 'PHP') }

      it 'is invalid' do
        expect(transfer).not_to be_valid
        expect(transfer.errors[:base]).to include('Both accounts must belong to the same space')
      end
    end

    context 'with same from and to accounts' do
      let(:to_account) { from_account }

      it 'is invalid' do
        expect(transfer).not_to be_valid
        expect(transfer.errors[:base]).to include('Cannot transfer to the same account')
      end
    end

    context 'with accounts having different currencies' do
      let(:to_account) { create(:account, space:, balance_currency: 'USD') }
      let(:from_account) { create(:account, space:, balance_currency: 'EUR') }

      it 'is invalid' do
        expect(transfer).not_to be_valid
        expect(transfer.errors[:base]).to include('Account currencies must match or exchange rate must be provided')
      end
    end

    context 'when amount is zero or negative' do
      it 'is invalid with zero amount' do
        transfer.amount = 0
        expect(transfer).not_to be_valid
        expect(transfer.errors[:amount_cents]).to include('must be greater than 0')
      end

      it 'is invalid with negative amount' do
        transfer.amount = -10
        expect(transfer).not_to be_valid
        expect(transfer.errors[:amount_cents]).to include('must be greater than 0')
      end
    end

    context 'when transaction cost is negative' do
      it 'is invalid' do
        transfer.transaction_cost = -5
        expect(transfer).not_to be_valid
        expect(transfer.errors[:transaction_cost_cents]).to include('must be greater than or equal to 0')
      end
    end
  end

  describe 'Repeatable concern' do
    subject(:transfer) do
      build(
        :transfer,
        user:,
        space:,
        from_account:,
        to_account:,
        amount_currency: 'PHP',
        transaction_cost_currency: 'PHP'
      )
    end

    let(:space) { create(:personal_space) }
    let(:from_account) { create(:account, space:, balance_currency: 'PHP') }
    let(:to_account) { create(:account, space:, balance_currency: 'PHP') }
    let(:user) { create(:user) }


    it { is_expected.to validate_presence_of(:schedule_type) }

    # For enum tests, we need to avoid using the shoulda-matchers directly because
    # the enums are defined in the Repeatable concern with string values instead of integers
    it 'defines schedule_type as an enum with string values' do
      expect(described_class.schedule_types).to eq(
        "one_time" => "one_time",
        "repeat" => "repeat",
        "installment" => "installment"
      )
    end

    it 'defines repeat_interval as an enum with string values' do
      expect(described_class.repeat_intervals).to eq(
        "every_day" => "every_day",
        "every_week" => "every_week",
        "every_2_weeks" => "every_2_weeks",
        "every_month" => "every_month",
        "every_2_months" => "every_2_months",
        "every_3_months" => "every_3_months",
        "every_6_months" => "every_6_months",
        "every_year" => "every_year"
      )
    end

    context 'with repeat schedule type' do
      subject(:transfer) do
        build(
          :transfer,
          user:,
          space:,
          from_account:,
          to_account:,
          amount_currency: 'PHP',
          transaction_cost_currency: 'PHP',
          schedule_type: 'repeat',
          repeat_interval: 'every_month',
          repeat_count: 5
        )
      end

      it 'is valid' do
        expect(transfer).to be_valid
      end

      it 'requires repeat_interval' do
        transfer.repeat_interval = nil
        expect(transfer).not_to be_valid
        expect(transfer.errors[:repeat_interval]).to include("can't be blank")
      end

      it 'requires repeat_count' do
        transfer.repeat_count = nil
        expect(transfer).not_to be_valid
        expect(transfer.errors[:repeat_count]).to include("can't be blank")
      end
    end

    context 'with one_time schedule type' do
      subject(:transfer) do
        build(
          :transfer,
          user:,
          space:,
          from_account:,
          to_account:,
          amount_currency: 'PHP',
          transaction_cost_currency: 'PHP',
          schedule_type: 'one_time',
          repeat_interval: nil,
          repeat_count: nil
        )
      end

      it 'does not require repeat_interval' do
        transfer.repeat_interval = nil
        expect(transfer).to be_valid
      end

      it 'does not require repeat_count' do
        transfer.repeat_count = nil
        expect(transfer).to be_valid
      end
    end
  end

  describe '#value' do
    let(:space) { create(:personal_space) }
    let(:from_account) { create(:account, space:, balance_currency: 'PHP') }
    let(:to_account) { create(:account, space:, balance_currency: 'PHP') }
    let(:transfer) do
      build(
        :transfer,
        from_account:,
        to_account:,
        space:,
        amount: 150,
        amount_currency: 'PHP'
      )
    end

    it 'returns the amount' do
      expect(transfer.value).to eq(Money.from_amount(150, 'PHP'))
    end
  end

  describe '#total_cost' do
    let(:space) { create(:personal_space) }
    let(:from_account) { create(:account, space:, balance_currency: 'PHP') }
    let(:to_account) { create(:account, space:, balance_currency: 'PHP') }
    let(:transfer) do
      build(
        :transfer,
        from_account:,
        to_account:,
        space:,
        amount: 150,
        amount_currency: 'PHP',
        transaction_cost: 10,
        transaction_cost_currency: 'PHP'
      )
    end

    it 'returns the sum of amount and transaction_cost' do
      expect(transfer.total_cost).to eq(Money.from_amount(160, 'PHP'))
    end
  end
end
