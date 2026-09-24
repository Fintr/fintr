# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::ReviseInstallmentPlan do
  subject(:operation) { described_class.new }

  let(:space) { create(:space) }
  let(:user) { create(:user) }
  let(:account) { create(:account, space:, balance: Money.from_amount(10_000, "PHP")) }
  let(:category) { create(:category, space:, category_type: "expense") }
  let(:parent_date) { Date.new(2026, 1, 1) }

  let!(:parent) do
    create(
      :transaction,
      type: "Transactions::Expense",
      user:,
      space:,
      account:,
      category:,
      amount: Money.from_amount(100, "PHP"),
      installment_total_cents: 120_000,
      date: parent_date,
      schedule_type: :installment,
      installment_period: 12,
      installment_count: 1,
      balance_state: :pending,
      balance: Money.from_amount(0, "PHP"),
    )
  end

  it "keeps total when extending the installment term" do
    parent.assign_attributes(installment_period: 14)

    result = operation.call(
      transaction: parent,
      update_scope: "this_and_future",
      anchor: "total",
    )

    expect(result).to be_success
    updated = result.value!
    expect(updated.installment_total.amount).to eq(1_200)
    expect(updated.amount.amount).to eq(85.71)
    expect(updated.installment_period).to eq(14)
  end

  it "keeps monthly when extending the installment term" do
    parent.assign_attributes(installment_period: 14)

    result = operation.call(
      transaction: parent,
      update_scope: "this_and_future",
      anchor: "monthly",
    )

    expect(result).to be_success
    updated = result.value!
    expect(updated.installment_total.amount).to eq(1_400)
    expect(updated.amount.amount).to eq(100)
  end

  it "succeeds for all-in-series when a payment is already recorded" do
    recorded_child = create(
      :transaction,
      type: "Transactions::Expense",
      user:,
      space:,
      account:,
      category:,
      amount: Money.from_amount(100, "PHP"),
      installment_total_cents: 120_000,
      date: parent_date + 1.month,
      schedule_type: :installment,
      installment_period: 12,
      parent_id: parent.id,
      balance_state: :calculated,
      balance: Money.from_amount(0, "PHP"),
    )

    result = operation.call(
      transaction: recorded_child,
      update_scope: "all_in_series",
      anchor: "explicit",
      installment_total: 2_400,
    )

    expect(result).to be_success
  end

  it "rewrites recorded payments when all-in-series revises the plan total" do
    recorded_child = create(
      :transaction,
      type: "Transactions::Expense",
      user:,
      space:,
      account:,
      category:,
      amount: Money.from_amount(100, "PHP"),
      installment_total_cents: 120_000,
      date: parent_date + 1.month,
      schedule_type: :installment,
      installment_period: 12,
      parent_id: parent.id,
      balance_state: :calculated,
      balance: Money.from_amount(0, "PHP"),
    )

    operation.call(
      transaction: recorded_child,
      update_scope: "all_in_series",
      anchor: "explicit",
      installment_total: 2_400,
    )

    expect(recorded_child.reload.amount.amount).to eq(200)
  end
end
