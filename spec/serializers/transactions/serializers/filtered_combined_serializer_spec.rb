# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Serializers::FilteredCombinedSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(record) }

  # Helper to create a mock Money object for amount and balance
  let(:mock_money_struct) { Struct.new(:amount) }
  let(:new_mock_money) { ->(val) { mock_money_struct.new(val) } }

  # Attached files helper
  let(:has_image) { false }
  let(:files) { OpenStruct.new(attached?: has_image) }
  let(:transactable) { OpenStruct.new(files: files) }

  let(:record_id) { SecureRandom.uuid }
  let(:record_date) { Date.new(2024, 7, 1) }
  let(:record_description) { "Monthly Salary" }
  let(:record_to_account_name) { "Checking Account" }
  let(:record_from_account_name) { "Company ABC" }
  let(:record_category_name) { "Salary" }
  let(:record_amount) { 1000.00 }
  let(:record_balance) { 2500.50 }

  let(:record) do
    OpenStruct.new(
      transactable_id: record_id,
      date: record_date,
      description: record_description,
      to_account_name: record_to_account_name,
      from_account_name: record_from_account_name,
      category_name: record_category_name,
      value: new_mock_money.call(record_amount), # Simulates Money object for value
      balance: new_mock_money.call(record_balance), # Simulates Money object for balance
      transactable_type: "Transactions::Income",
      in_series?: false,
      transactable: transactable
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

  it 'includes the to_account_name' do
    expect(serialized_hash[:to_account_name]).to eq(record_to_account_name)
  end

  it 'includes the from_account_name' do
    expect(serialized_hash[:from_account_name]).to eq(record_from_account_name)
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
    context 'when transactable_type is Transactions::Income' do
      let(:record) do
        OpenStruct.new(
          transactable_id: record_id,
          date: record_date,
          description: record_description,
          to_account_name: record_to_account_name,
          from_account_name: record_from_account_name,
          category_name: record_category_name,
          value: new_mock_money.call(record_amount),
          balance: new_mock_money.call(record_balance),
          transactable_type: "Transactions::Income",
          in_series?: false,
          transactable: transactable
        )
      end

      it 'returns "income"' do
        expect(serialized_hash[:type]).to eq("income")
      end
    end

    context 'when transactable_type is Transactions::Expense' do
      let(:record) do
        OpenStruct.new(
          transactable_id: record_id,
          date: record_date,
          description: record_description,
          to_account_name: record_to_account_name,
          from_account_name: record_from_account_name,
          category_name: record_category_name,
          value: new_mock_money.call(record_amount),
          balance: new_mock_money.call(record_balance),
          transactable_type: "Transactions::Expense",
          in_series?: false,
          transactable: transactable
        )
      end

      it 'returns "expense"' do
        expect(serialized_hash[:type]).to eq("expense")
      end
    end

    context 'when transactable_type is Transactions::Transfer' do
      let(:record) do
        OpenStruct.new(
          transactable_id: record_id,
          date: record_date,
          description: record_description,
          to_account_name: record_to_account_name,
          from_account_name: record_from_account_name,
          category_name: nil, # Transfers have no category
          value: new_mock_money.call(record_amount),
          balance: new_mock_money.call(record_balance),
          transactable_type: "Transactions::Transfer",
          in_series?: false,
          transactable: transactable
        )
      end

      it 'returns "transfer"' do
        expect(serialized_hash[:type]).to eq("transfer")
      end
    end

    context 'when transactable_type is unknown' do
      let(:record) do
        OpenStruct.new(
          transactable_id: record_id,
          date: record_date,
          description: record_description,
          to_account_name: record_to_account_name,
          from_account_name: record_from_account_name,
          category_name: record_category_name,
          value: new_mock_money.call(record_amount),
          balance: new_mock_money.call(record_balance),
          transactable_type: "Unknown::Type",
          in_series?: false,
          transactable: transactable
        )
      end

      it 'returns nil' do
        expect(serialized_hash[:type]).to be_nil
      end
    end
  end

  it 'serializes all expected top-level fields' do
    expected_keys = [
      :id,
      :date,
      :description,
      :to_account_name,
      :from_account_name,
      :category_name,
      :amount,
      :balance,
      :type,
      :in_series,
      :has_image
    ]
    # Re-initialize record for this specific test to ensure all fields are present
    # This is because the :type field tests redefine 'record' with only transactable_type
    local_record = OpenStruct.new(
      transactable_id: record_id,
      date: record_date,
      description: record_description,
      to_account_name: record_to_account_name,
      from_account_name: record_from_account_name,
      category_name: record_category_name,
      value: new_mock_money.call(record_amount),
      balance: new_mock_money.call(record_balance),
      transactable_type: "Transactions::Income",
      in_series?: false,
      transactable: transactable
    )
    expect(described_class.render_as_hash(local_record).keys).to match_array(expected_keys)
  end

  context 'when optional fields are nil' do
    subject(:serialized_hash_with_nils) { described_class.render_as_hash(record_with_nils) }

    let(:record_with_nils) do
      OpenStruct.new(
        transactable_id: record_id,
        date: record_date,
        description: nil, # description is nil
        to_account_name: nil,
        from_account_name: nil,
        category_name: nil,
        value: nil, # value (and thus amount) can be nil
        balance: nil, # balance can be nil
        transactable_type: "Transactions::Expense",
        in_series?: false,
        transactable: transactable
      )
    end


    it 'includes nil for description' do
      expect(serialized_hash_with_nils[:description]).to be_nil
    end

    it 'includes nil for to_account_name' do
      expect(serialized_hash_with_nils[:to_account_name]).to be_nil
    end

    it 'includes nil for from_account_name' do
      expect(serialized_hash_with_nils[:from_account_name]).to be_nil
    end

    it 'includes nil for category_name' do
      expect(serialized_hash_with_nils[:category_name]).to be_nil
    end

    it 'includes nil for amount when value is nil' do
      expect(serialized_hash_with_nils[:amount]).to be_nil
    end

    it 'includes nil for balance when balance object is nil' do
      expect(serialized_hash_with_nils[:balance]).to be_nil
    end

    it 'still serializes mandatory fields and type correctly' do
      expect(serialized_hash_with_nils[:id]).to eq(record_id)
      expect(serialized_hash_with_nils[:date]).to eq(record_date)
      expect(serialized_hash_with_nils[:type]).to eq("expense")
    end
  end

  context 'when value or balance objects are present but their amount is nil' do
    subject(:serialized_hash_with_nil_amounts) { described_class.render_as_hash(record_with_nil_amounts) }

    let(:record_with_nil_amounts) do
      OpenStruct.new(
        id: record_id,
        date: record_date,
        value: new_mock_money.call(nil), # amount within value is nil
        balance: new_mock_money.call(nil), # amount within balance is nil
        transactable_type: "Transactions::Transfer",
        transactable: transactable,
        in_series?: false
      )
    end


    it 'includes nil for amount when value.amount is nil' do
      expect(serialized_hash_with_nil_amounts[:amount]).to be_nil
    end

    it 'includes nil for balance when balance.amount is nil' do
      expect(serialized_hash_with_nil_amounts[:balance]).to be_nil
    end
  end

  context 'has_image field' do
    let(:record) do
      OpenStruct.new(
        transactable_id: record_id,
        date: record_date,
        description: record_description,
        to_account_name: record_to_account_name,
        from_account_name: record_from_account_name,
        category_name: record_category_name,
        value: new_mock_money.call(record_amount),
        balance: new_mock_money.call(record_balance),
        transactable_type: "Transactions::Income",
        in_series?: false,
        transactable: transactable
      )
    end

    context 'when files are attached' do
      let(:has_image) { true }

      it 'returns true' do
        expect(serialized_hash[:has_image]).to eq(true)
      end
    end

    context 'when files are not attached' do
      let(:has_image) { false }

      it 'returns false' do
        expect(serialized_hash[:has_image]).to eq(false)
      end
    end
  end
end
