# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Serializers::TransactionSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(transaction) }

  let(:space) { create(:personal_space, currency: "PHP") }
  let(:usd_account) do
    create(
      :account,
      space: space,
      balance_currency: "USD",
      balance: Money.from_amount(0, "USD")
    )
  end
  let(:category) { create(:category, space: space, category_type: "expense") }
  let(:transaction) do
    create(
      :expense_transaction,
      :one_time,
      space: space,
      account: usd_account,
      category: category,
      amount: 121_327.97,
      amount_currency: "USD",
      balance_currency: "USD"
    )
  end


  it "serializes booked amount and currency on top-level amount fields" do
    expect(serialized_hash[:amount]).to eq(121_327.97)
    expect(serialized_hash[:amount_currency]).to eq("USD")
  end

  it "mirrors ledger amount onto booked_* when there is no conversion" do
    expect(serialized_hash[:booked_amount]).to eq(121_327.97)
    expect(serialized_hash[:booked_amount_currency]).to eq("USD")
  end

  context "with a persisted GBP→PHP conversion" do
    let(:php_account) do
      create(
        :account,
        space: space,
        balance_currency: "PHP",
        balance: Money.from_amount(0, "PHP")
      )
    end
    let(:transaction) do
      create(
        :expense_transaction,
        :one_time,
        space: space,
        account: php_account,
        category: category,
        amount: Money.from_amount(20_000, "PHP"),
        amount_currency: "PHP",
        balance_currency: "PHP"
      )
    end
    let!(:conversion) do
      ExchangeRates::CurrencyConversion.create!(
        convertible: transaction,
        space_id: space.id,
        original_amount_cents: 200_00,
        original_currency: "GBP",
        converted_amount_cents: 20_000_00,
        converted_currency: "PHP",
        exchange_rate: 100,
        source: "recent",
        rate_timestamp: Time.current
      )
    end

    it "exposes the original GBP amount for view and edit" do
      transaction.reload
      expect(serialized_hash[:original_display_amount]).to eq(200)
      expect(serialized_hash[:original_display_currency]).to eq("GBP")
      expect(serialized_hash[:booked_amount]).to eq(-200)
      expect(serialized_hash[:booked_amount_currency]).to eq("GBP")
      expect(serialized_hash[:amount]).to eq(20_000)
      expect(serialized_hash[:amount_currency]).to eq("PHP")
    end
  end

  it "includes amount_in_space_currency for space-context display" do
    payload = serialized_hash[:amount_in_space_currency]
    expect(payload).to be_a(Hash)
    expect(payload[:amount]).to be_a(Numeric)
    expect(payload[:currency]).to be_a(String)
    expect(payload[:currency].length).to eq(3)
  end

  it "includes account_id" do
    expect(serialized_hash[:account_id]).to eq(usd_account.id)
  end

  it "includes entity_id when the transaction has no entity" do
    expect(serialized_hash[:entity_id]).to be_nil
  end

  context "with a subcategory" do
    let(:subcategory) do
      create(
        :category,
        :subcategory,
        space: space,
        parent: category,
        name: "Flights",
        category_type: "expense",
      )
    end
    let(:transaction) do
      create(
        :expense_transaction,
        :one_time,
        space: space,
        account: usd_account,
        category: category,
        subcategory: subcategory,
        amount: 50,
        amount_currency: "USD",
        balance_currency: "USD",
      )
    end

    it "serializes parent and subcategory assignment fields" do
      expect(serialized_hash[:category_id]).to eq(category.id)
      expect(serialized_hash[:category_name]).to eq(category.name)
      expect(serialized_hash[:subcategory_id]).to eq(subcategory.id)
      expect(serialized_hash[:subcategory_name]).to eq("Flights")
    end
  end
end
