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
  let(:loan_payment) { nil }
  let(:transactable) { OpenStruct.new(files: files, loan_payment: loan_payment) }

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
      :subcategory_name,
      :amount,
      :amount_currency,
      :booked_amount,
      :booked_amount_currency,
      :balance,
      :calculated,
      :type,
      :loan_id,
      :entity_name,
      :loan_type,
      :is_loan_activity,
      :activitable_id,
      :in_series,
      :has_image,
      :has_loan_payment
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

  context 'when has_image field' do
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
        expect(serialized_hash[:has_image]).to be(true)
      end
    end

    context 'when files are not attached' do
      let(:has_image) { false }

      it 'returns false' do
        expect(serialized_hash[:has_image]).to be(false)
      end
    end
  end

  context 'when has_loan_payment field' do
    it 'always returns false' do
      expect(serialized_hash[:has_loan_payment]).to be(false)
    end
  end

  context 'when transfer is USD–USD on a PHP space (paginated index row)' do
    subject(:serialized_hash) { described_class.render_as_hash(combined_record) }

    let(:space) { create(:personal_space, currency: 'PHP') }
    let(:user) { create(:user) }
    let(:from_usd) do
      create(
        :account,
        space:,
        name: 'From USD',
        balance: Money.from_amount(1000, 'USD'),
        balance_currency: 'USD'
      )
    end
    let(:to_usd) do
      create(
        :account,
        space:,
        name: 'To USD',
        balance: Money.from_amount(500, 'USD'),
        balance_currency: 'USD'
      )
    end
    let(:rate_date) { Date.new(2024, 6, 1) }

    let!(:transfer) do
      create(
        :transfer,
        user:,
        space:,
        from_account: from_usd,
        to_account: to_usd,
        date: rate_date,
        amount: Money.from_amount(500, 'USD'),
        amount_currency: 'USD'
      )
    end

    let(:combined_record) do
      transfer.reload
      Transactions::Combined.find_by!(
        transactable_id: transfer.id,
        transactable_type: 'Transactions::Transfer'
      )
    end

    before do
      ExchangeRates::ApiExchangeRate.create!(
        base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
        target_currency: 'PHP',
        rate: 50.0,
        rate_date: rate_date
      )
    end

    it 'returns space-normalized amount and currency on amount fields' do
      expect(serialized_hash[:amount]).to eq(25_000.0)
      expect(serialized_hash[:amount_currency]).to eq('PHP')
    end

    it 'returns booked USD on booked_* for the list currency toggle' do
      expect(serialized_hash[:booked_amount]).to eq(500.0)
      expect(serialized_hash[:booked_amount_currency]).to eq('USD')
    end
  end

  context 'when transactable has a persisted currency_conversion' do
    subject(:serialized_hash) { described_class.render_as_hash(combined_record) }

    let(:space) { create(:personal_space, currency: 'PHP') }
    let(:usd_account) { create(:account, space:, balance_currency: 'USD', name: 'USD Account') }
    let(:category) { create(:category, space:, category_type: 'expense', name: 'Home') }
    let(:expense) do
      create(
        :expense_transaction,
        :one_time,
        space:,
        account: usd_account,
        category:,
        amount: Money.from_amount(16.48, 'PHP'),
        amount_currency: 'PHP',
        date: Date.current
      )
    end

    let!(:conversion) do
      ExchangeRates::CurrencyConversion.create!(
        convertible: expense,
        space_id: space.id,
        original_amount_cents: 1000_00,
        original_currency: 'PHP',
        converted_amount_cents: 1648,
        converted_currency: 'USD',
        exchange_rate: 0.01648,
        source: 'manual',
        rate_timestamp: Time.current
      )
    end

    let(:combined_record) do
      expense.reload
      Transactions::Combined.find_by!(
        transactable_id: expense.id,
        transactable_type: 'Transactions::Expense'
      )
    end

    it 'uses original amount and currency for booked_* (list toggle), signed like the expense' do
      expect(serialized_hash[:booked_amount]).to eq(-1000)
      expect(serialized_hash[:booked_amount_currency]).to eq('PHP')
    end
  end
end
