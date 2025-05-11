# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Serializers::FilteredTransactionsSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(transaction_record) }

  # Helper to create a mock Money object for amount and balance
  let(:mock_money_struct) { Struct.new(:amount) }
  let(:new_mock_money) { ->(val) { mock_money_struct.new(val) } }

  let(:record_id) { SecureRandom.uuid }
  let(:record_date) { Date.new(2024, 7, 15) }
  let(:record_description) { "Lunch Meeting" }
  let(:record_account_name) { "Business Credit Card" }
  let(:record_category_name) { "Meals & Entertainment" }
  let(:record_amount) { 75.50 }
  let(:record_balance) { 1203.25 }

  let(:transaction_record) do
    OpenStruct.new(
      id: record_id,
      date: record_date,
      description: record_description,
      account_name: record_account_name,
      category_name: record_category_name,
      value: new_mock_money.call(record_amount), # Simulates Money object for value
      balance: new_mock_money.call(record_balance), # Simulates Money object for balance
      type: "Transactions::Expense" # Note: serializer uses 'type' field directly
    )
  end

  it 'includes the id' do
    expect(serialized_hash[:id]).to eq(record_id)
  end

  it 'includes the date' do
    expect(serialized_hash[:date]).to eq(record_date)
  end

  it 'includes the description' do
    expect(serialized_hash[:description]).to eq(record_description)
  end

  it 'includes the account_name' do
    expect(serialized_hash[:account_name]).to eq(record_account_name)
  end

  it 'includes the category_name' do
    expect(serialized_hash[:category_name]).to eq(record_category_name)
  end

  it 'includes the amount from value' do
    expect(serialized_hash[:amount]).to eq(record_amount)
  end

  it 'includes the balance' do
    expect(serialized_hash[:balance]).to eq(record_balance)
  end

  describe ':type field' do
    context 'when transaction.type is Transactions::Income' do
      let(:transaction_record) { OpenStruct.new(type: "Transactions::Income", value: new_mock_money.call(0), balance: new_mock_money.call(0)) }

      it 'returns "income"' do
        expect(serialized_hash[:type]).to eq("income")
      end
    end

    context 'when transaction.type is Transactions::Expense' do
      let(:transaction_record) { OpenStruct.new(type: "Transactions::Expense", value: new_mock_money.call(0), balance: new_mock_money.call(0)) }

      it 'returns "expense"' do
        expect(serialized_hash[:type]).to eq("expense")
      end
    end

    context 'when transaction.type is Transactions::Transfer' do
      let(:transaction_record) { OpenStruct.new(type: "Transactions::Transfer", value: new_mock_money.call(0), balance: new_mock_money.call(0)) }

      it 'returns "transfer"' do
        expect(serialized_hash[:type]).to eq("transfer")
      end
    end

    context 'when transaction.type is something else' do
      let(:transaction_record) { OpenStruct.new(type: "Unknown::Type", value: new_mock_money.call(0), balance: new_mock_money.call(0)) }

      it 'returns nil' do # Based on the serializer logic, if none of the conditions match, it will be nil
        expect(serialized_hash[:type]).to be_nil
      end
    end
  end

  it 'serializes all expected top-level fields' do
    expected_keys = [
      :id,
      :date,
      :description,
      :account_name,
      :category_name,
      :amount,
      :balance,
      :type
    ]
    # Re-initialize record for this specific test to ensure all fields are present
    local_record = OpenStruct.new(
      id: record_id,
      date: record_date,
      description: record_description,
      account_name: record_account_name,
      category_name: record_category_name,
      value: new_mock_money.call(record_amount),
      balance: new_mock_money.call(record_balance),
      type: "Transactions::Expense"
    )
    expect(described_class.render_as_hash(local_record).keys).to match_array(expected_keys)
  end

  context 'when optional fields are nil' do
    subject(:serialized_hash_with_nils) { described_class.render_as_hash(record_with_nils) }

    let(:record_with_nils) do
      OpenStruct.new(
        id: record_id,
        date: record_date,
        description: nil,
        account_name: nil,
        category_name: nil,
        value: new_mock_money.call(nil), # Amount can be nil if value.amount is nil
        balance: new_mock_money.call(nil), # Balance can be nil if balance.amount is nil
        type: "Transactions::Income"
      )
    end

    it 'includes nil for description' do
      expect(serialized_hash_with_nils[:description]).to be_nil
    end

    it 'includes nil for account_name' do
      expect(serialized_hash_with_nils[:account_name]).to be_nil
    end

    it 'includes nil for category_name' do
      expect(serialized_hash_with_nils[:category_name]).to be_nil
    end

    it 'includes nil for amount when value.amount is nil' do
      expect(serialized_hash_with_nils[:amount]).to be_nil
    end

    it 'includes nil for balance when balance.amount is nil' do
      expect(serialized_hash_with_nils[:balance]).to be_nil
    end

    it 'still serializes mandatory fields and type correctly' do
      expect(serialized_hash_with_nils[:id]).to eq(record_id)
      expect(serialized_hash_with_nils[:date]).to eq(record_date)
      expect(serialized_hash_with_nils[:type]).to eq("income")
    end
  end

  context 'when value or balance objects themselves are nil (more robust nil handling)' do
    subject(:serialized_hash_with_nil_objects) { described_class.render_as_hash(record_with_nil_objects) }

    let(:record_with_nil_objects) do
      OpenStruct.new(
        id: record_id,
        date: record_date,
        value: nil, # value object itself is nil
        balance: nil, # balance object itself is nil
        type: "Transactions::Transfer"
      )
    end

    # The serializer will raise NoMethodError: undefined method `amount` for nil:NilClass
    # if value or balance are nil. This tests that behavior if not handled by `&.` in serializer.
    # The current serializer does NOT use `&.` for value.amount or balance.amount, so it would fail.
    # Let's assume the serializer should be robust to this or that the input always provides these objects.
    # For this test, we'll test the failure case if it's not robust, or adjust if it is.
    # For now, assuming it *should* be robust, we'd expect nil.
    # If the serializer is `transaction.value&.amount`, then this is fine.
    # The current serializer is `transaction.value.amount`, so this would error.
    # We will write the test expecting an error, as per current serializer code.

    it 'raises an error for amount if value object is nil' do
      expect { serialized_hash_with_nil_objects[:amount] }.to raise_error(NoMethodError)
    end

    it 'raises an error for balance if balance object is nil' do
      expect { serialized_hash_with_nil_objects[:balance] }.to raise_error(NoMethodError)
    end
  end
end
