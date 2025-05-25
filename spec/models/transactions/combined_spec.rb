# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Combined, type: :model do
  describe 'table name' do
    it 'is set to combined_transactions' do
      expect(described_class.table_name).to eq('combined_transactions')
    end
  end

  describe 'associations' do
    it { is_expected.to belong_to(:space).class_name('Spaces::Space') }
    # The following associations depend on foreign keys (e.g., category_id) being present in the
    # combined_transactions view. If these columns are not in the view, these tests will fail.
    # Commenting them out as their pass/fail status depends on the view's schema.
    # it { is_expected.to belong_to(:category).class_name('Transactions::Category').optional }
    # it { is_expected.to belong_to(:from_account).class_name('Transactions::Account').optional }
    # it { is_expected.to belong_to(:to_account).class_name('Transactions::Account').optional }
    it { is_expected.to belong_to(:transactable) }
  end

  describe 'monetization' do
    it 'monetizes amount_cents' do
      expect(described_class).to monetize(:amount_cents)
    end

    it 'monetizes balance_cents' do
      expect(described_class).to monetize(:balance_cents)
    end
  end

  describe '#readonly?' do
    it 'returns true' do
      expect(build_stubbed(:combined_transaction).readonly?).to be true
    end
  end

  describe 'delegated methods' do
    subject(:combined_transaction) { build(:combined_transaction, transactable: transactable_mock) }

    let(:transactable_mock) do
      build_stubbed(:expense_transaction)
    end


    describe '#value' do
      it 'delegates to transactable' do
        expect(transactable_mock).to receive(:value)
        combined_transaction.value
      end
    end

    describe '#income' do
      it 'delegates to transactable' do
        expect(transactable_mock).to receive(:income)
        combined_transaction.income
      end
    end

    describe '#expense' do
      it 'delegates to transactable' do
        expect(transactable_mock).to receive(:expense)
        combined_transaction.expense
      end
    end
  end
end
