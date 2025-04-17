# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Expense, type: :model do
  let(:user) { create(:user) } # Assuming a :user factory exists

  # Define let blocks for different expense scenarios
  let(:expense_with_amount) do
    build(
      :expense_transaction,
      user: user,
      date: Time.zone.today,
      amount: 150.50, # Assuming amount is stored positively
      amount_currency: 'PHP',
      balance: 500.00, # Example balance
      balance_currency: 'PHP'
    )
  end

  let(:expense_with_zero_amount) do
    build(
      :expense_transaction,
      user: user,
      date: Time.zone.today,
      amount: 0.00,
      amount_currency: 'PHP',
      balance: 349.50, # Example balance
      balance_currency: 'PHP'
    )
  end

  let(:basic_expense) do
    build(
      :expense_transaction,
      user: user,
      date: Time.zone.today,
      amount: 10.00,
      amount_currency: 'PHP',
      balance: 10.00,
      balance_currency: 'PHP'
    )
  end

  describe '#value' do
    it 'returns the negative of the transaction amount' do
      # Assuming amount is stored as 150.50 and value should be -150.50
      # If using money-rails, the amount is likely stored in cents (15050)
      # The #value method in Expense returns amount * -1
      # Let's test based on the Expense#value implementation
      expect(expense_with_amount.value.amount).to eq(-150.50)
      # If amount is a Money object, the comparison might need adjustment:
      # expect(expense_with_amount.value).to eq(Money.from_cents(-15050, 'PHP'))
    end

    it 'returns zero when the amount is zero' do
      expect(expense_with_zero_amount.value.amount).to eq(0.00)
      # If amount is a Money object:
      # expect(expense_with_zero_amount.value).to eq(Money.from_cents(0, 'PHP'))
    end
  end

  describe 'inheritance' do
    it 'is a type of Transaction' do
      expect(described_class).to be < Transactions::Transaction
    end

    it 'can be created with the correct type' do
      expect(basic_expense).to be_a(described_class)
      expect(basic_expense.type).to eq(described_class.name)
    end
  end

  # Add any validations specific to Expense here, if applicable.
end
