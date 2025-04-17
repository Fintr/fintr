# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Income, type: :model do
  # Assuming a :user factory exists
  let(:user) { create(:user) }

  # Define let blocks for different income scenarios
  let(:income_with_amount) do
    build(
      :income_transaction,
      user: user,
      date: Time.zone.today,
      amount: 150.5,
      amount_currency: 'PHP',
      balance: 500_00, # Example balance, adjust if calculated differently
      balance_currency: 'PHP'
    )
  end

  let(:income_with_zero_amount) do
    build(
      :income_transaction,
      user: user,
      date: Time.zone.today,
      amount: 0,
      balance: 349.5, # Example balance
      amount_currency: 'PHP',
      balance_currency: 'PHP'
    )
  end

  let(:basic_income) do
    build(
      :income_transaction,
      user: user,
      date: Time.zone.today,
      amount: 10,
      balance: 10,
      amount_currency: 'PHP',
      balance_currency: 'PHP'
    )
  end

  describe '#value' do
    it 'returns the transaction amount' do
      expect(income_with_amount.value.amount).to eq(150.5)
    end

    it 'returns zero when the amount is zero' do
      expect(income_with_zero_amount.value.amount).to eq(0)
    end
  end

  # Basic check to ensure STI setup is potentially working
  describe 'inheritance' do
    it 'is a type of Transaction' do
      expect(described_class).to be < Transactions::Transaction
    end

    it 'can be created with the correct type' do
      expect(basic_income).to be_a(described_class)
      expect(basic_income.type).to eq(described_class.name)
    end
  end
end
