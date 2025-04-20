# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Expense, type: :model do
  let(:user) { create(:user) } # Assuming a :user factory exists
  let(:space) { create(:space) }
  let(:account) { create(:account, space: space) }
  let(:category) { create(:category, space: space, category_type: 'expense') }

  # Define let blocks for different expense scenarios
  let(:expense_with_amount) do
    build(
      :expense_transaction,
      user: user,
      space: space,
      account: account,
      category: category,
      date: Time.zone.today,
      amount: 150.50, # Assuming amount is stored positively
      amount_currency: 'PHP',
      balance: 500.00, # Example balance
      balance_currency: 'PHP',
      expense_type: 'one_time'
    )
  end

  let(:expense_with_zero_amount) do
    build(
      :expense_transaction,
      user: user,
      space: space,
      account: account,
      category: category,
      date: Time.zone.today,
      amount: 0.00,
      amount_currency: 'PHP',
      balance: 349.50, # Example balance
      balance_currency: 'PHP',
      expense_type: 'one_time'
    )
  end

  let(:basic_expense) do
    build(
      :expense_transaction,
      user: user,
      space: space,
      account: account,
      category: category,
      date: Time.zone.today,
      amount: 10.00,
      amount_currency: 'PHP',
      balance: 10.00,
      balance_currency: 'PHP',
      expense_type: 'one_time'
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

  # New specs for expense_type enum and validations
  describe 'expense_type enum' do
    it 'defines the correct expense types' do
      expect(described_class.expense_types.keys).to match_array(%w[one_time repeat installment])
      expect(described_class.expense_types.values).to match_array(%w[one_time repeat installment])
    end

    it 'allows setting a valid expense type' do
      expense = build(:expense_transaction, expense_type: 'one_time')
      expect(expense).to be_valid
      expect(expense.expense_type).to eq('one_time')
      expect(expense).to be_one_time
    end

    it 'validates presence of expense_type' do
      expense = build(:expense_transaction, expense_type: nil)
      expect(expense).not_to be_valid
      expect(expense.errors[:expense_type]).to include("can't be blank")
    end

    it 'validates inclusion of expense_type in allowed values' do
      expect { build(:expense_transaction, expense_type: 'invalid_type') }.to raise_error(ArgumentError)
    end
  end

  describe 'repeat expense validations' do
    let(:repeat_expense) do
      build(
        :expense_transaction,
        user: user,
        space: space,
        account: account,
        category: category,
        expense_type: 'repeat',
        repeat_interval: nil,
        repeat_count: nil
      )
    end

    it 'requires repeat_interval when expense_type is repeat' do
      expect(repeat_expense).not_to be_valid
      expect(repeat_expense.errors[:repeat_interval]).to include("can't be blank")
    end

    it 'requires repeat_count when expense_type is repeat' do
      expect(repeat_expense).not_to be_valid
      expect(repeat_expense.errors[:repeat_count]).to include("can't be blank")
    end

    it 'does not require repeat fields when expense_type is one_time' do
      expense = build(
        :expense_transaction,
        user: user,
        space: space,
        account: account,
        category: category,
        expense_type: 'one_time',
        repeat_interval: nil,
        repeat_count: nil
      )

      # We only check these specific fields, the model might be invalid for other reasons
      expense.valid?
      expect(expense.errors[:repeat_interval]).to be_empty
      expect(expense.errors[:repeat_count]).to be_empty
    end

    it 'is valid with repeat fields when expense_type is repeat' do
      expense = build(
        :expense_transaction,
        user: user,
        space: space,
        account: account,
        category: category,
        expense_type: 'repeat',
        repeat_interval: 'monthly',
        repeat_count: 3
      )

      # We only check these specific validations pass
      expense.valid?
      expect(expense.errors[:repeat_interval]).to be_empty
      expect(expense.errors[:repeat_count]).to be_empty
    end
  end

  describe 'installment expense validations' do
    let(:installment_expense) do
      build(
        :expense_transaction,
        user: user,
        space: space,
        account: account,
        category: category,
        expense_type: 'installment',
        installment_period: nil,
        installment_count: nil
      )
    end

    it 'requires installment_period when expense_type is installment' do
      expect(installment_expense).not_to be_valid
      expect(installment_expense.errors[:installment_period]).to include("can't be blank")
    end

    it 'requires installment_count when expense_type is installment' do
      expect(installment_expense).not_to be_valid
      expect(installment_expense.errors[:installment_count]).to include("can't be blank")
    end

    it 'does not require installment fields when expense_type is one_time' do
      expense = build(
        :expense_transaction,
        user: user,
        space: space,
        account: account,
        category: category,
        expense_type: 'one_time',
        installment_period: nil,
        installment_count: nil
      )

      # We only check these specific fields, the model might be invalid for other reasons
      expense.valid?
      expect(expense.errors[:installment_period]).to be_empty
      expect(expense.errors[:installment_count]).to be_empty
    end

    it 'is valid with installment fields when expense_type is installment' do
      expense = build(
        :expense_transaction,
        user: user,
        space: space,
        account: account,
        category: category,
        expense_type: 'installment',
        installment_period: 'monthly',
        installment_count: 6
      )

      # We only check these specific validations pass
      expense.valid?
      expect(expense.errors[:installment_period]).to be_empty
      expect(expense.errors[:installment_count]).to be_empty
    end
  end

  # Add any validations specific to Expense here, if applicable.
end
