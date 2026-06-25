# frozen_string_literal: true

require "rails_helper"

RSpec.describe MonthlyFinancialSummaries::Queries::EarliestTransactionDateForSpace do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:account) { create(:account, space:) }
  let(:category) { create(:category, space:, category_type: "expense") }

  describe ".call" do
    subject(:earliest_date) { described_class.call(space:) }

    it "returns nil when the space has no calculated transactions" do
      expect(earliest_date).to be_nil
    end

    it "returns the earliest calculated transaction date excluding initial balance" do
      create(
        :expense_transaction,
        space:,
        user:,
        account:,
        category:,
        date: Date.new(2024, 4, 10),
        balance_state: :calculated
      )
      create(
        :expense_transaction,
        space:,
        user:,
        account:,
        category:,
        date: Date.new(2024, 2, 15),
        balance_state: :calculated
      )

      expect(earliest_date).to eq(Date.new(2024, 2, 15))
    end
  end
end
