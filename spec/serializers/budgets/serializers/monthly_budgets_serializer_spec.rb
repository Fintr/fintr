# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Budgets::Serializers::MonthlyBudgetsSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(budget_object) }

  let(:budget_object) do
    # Using an OpenStruct to simulate an object that the serializer would receive.
    # This object might typically be an ActiveRecord model or a decorator/presenter.
    OpenStruct.new(
      id: SecureRandom.uuid,
      date: Date.new(2024, 7, 28),
      amount_cents: 15000, # 150.00
      category_name: "Food Expenses",
      total_spent: 75.50,
      amount_currency: "USD"
    )
  end


  it 'includes the id' do
    expect(serialized_hash[:id]).to eq(budget_object.id)
  end

  it 'includes the date' do
    # When using render_as_hash, Blueprinter might pass Date objects directly.
    # If rendering to JSON string, it would typically be ISO8601.
    expect(serialized_hash[:date]).to eq(budget_object.date)
  end

  it 'includes the category_name' do
    expect(serialized_hash[:category_name]).to eq(budget_object.category_name)
  end

  it 'includes the total_spent' do
    expect(serialized_hash[:total_spent]).to eq(budget_object.total_spent)
  end

  it 'includes the amount_currency' do
    expect(serialized_hash[:amount_currency]).to eq(budget_object.amount_currency)
  end

  it 'calculates and includes the amount correctly' do
    expected_amount = budget_object.amount_cents / 100.0
    expect(serialized_hash[:amount]).to eq(expected_amount)
  end

  it 'serializes all expected fields' do
    expected_keys = [
      :id,
      :date,
      :category_name,
      :total_spent,
      :amount_currency,
      :amount
    ]
    expect(serialized_hash.keys).to match_array(expected_keys)
  end

  context 'when a field is nil' do
    subject(:serialized_hash_with_nil) { described_class.render_as_hash(budget_object_with_nil) }

    let(:budget_object_with_nil) do
      OpenStruct.new(
        id: SecureRandom.uuid,
        date: Date.new(2024, 7, 28),
        amount_cents: 20000,
        category_name: nil, # category_name is nil
        total_spent: 150.75,
        amount_currency: "EUR"
      )
    end


    it 'includes nil for the nil field' do
      # Blueprinter includes nil fields by default unless configured otherwise
      expect(serialized_hash_with_nil[:category_name]).to be_nil
    end

    it 'still serializes other fields correctly' do
      expect(serialized_hash_with_nil[:total_spent]).to eq(150.75)
      expect(serialized_hash_with_nil[:amount]).to eq(200.00)
    end
  end
end
