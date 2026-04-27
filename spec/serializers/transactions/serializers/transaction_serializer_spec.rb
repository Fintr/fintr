# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Serializers::TransactionSerializer do
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

  subject(:serialized_hash) { described_class.render_as_hash(transaction) }

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
end
