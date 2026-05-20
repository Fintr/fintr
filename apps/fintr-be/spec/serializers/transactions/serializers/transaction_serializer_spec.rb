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

  it "includes amount_in_space_currency for space-context display" do
    payload = serialized_hash[:amount_in_space_currency]
    expect(payload).to be_a(Hash)
    expect(payload[:amount]).to be_a(Numeric)
    expect(payload[:currency]).to be_a(String)
    expect(payload[:currency].length).to eq(3)
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
