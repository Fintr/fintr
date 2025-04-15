# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Income, type: :model do
  # Assuming a :user factory exists
  let(:user) { create(:user) }

  # Define let blocks for different income scenarios
  let(:income_with_amount) do
    build(
      :transaction,
      user: user,
      type: 'Transactions::Income',
      date: Time.zone.today,
      amount: 150_50,
      balance: 500_00 # Example balance, adjust if calculated differently
    )
  end

  let(:income_with_zero_amount) do
    build(
      :transaction,
      user: user,
      type: 'Transactions::Income',
      date: Time.zone.today,
      amount: 0_00,
      balance: 349_50 # Example balance
    )
  end

  let(:basic_income) do
    build(
      :transaction,
      user: user,
      type: 'Transactions::Income',
      date: Time.zone.today,
      amount: 10_00,
      balance: 10_00
    )
  end

  describe '#value' do
    it 'returns the transaction amount' do
      expect(income_with_amount.value).to eq(150_50)
    end

    it 'returns zero when the amount is zero' do
      expect(income_with_zero_amount.value).to eq(0_00)
    end
  end

  # Basic check to ensure STI setup is potentially working
  describe 'inheritance' do
    it 'is a type of Transaction' do
      expect(described_class).to be < Transaction
    end

    it 'can be created with the correct type' do
      expect(basic_income).to be_a(described_class)
      expect(basic_income.type).to eq(described_class.name)
    end
  end

  # Add any validations specific to Income here, if applicable.
  # Otherwise, rely on Transaction model specs for shared validations.
end
