# frozen_string_literal: true

require "rails_helper"

RSpec.describe Sync::Operations::BootstrapSpace do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:space_user) { create(:space_user, user:, space:) }
  let(:account) { create(:account, space:) }
  let(:category) { create(:category, space:, category_type: "expense", name: "Food") }
  let!(:expense) do
    create(
      :expense_transaction,
      space:,
      account:,
      category:,
      user:,
      amount: Money.from_amount(25, "PHP"),
      date: Date.current,
      description: "Bootstrap lunch",
    )
  end

  before do
    Sync::SpaceSequence.create!(space_id: space.id, last_seq: 42)
  end

  describe "#call" do
    it "returns a consistent snapshot with latestSeq and totals" do
      result = described_class.new.call(
        space_id: space.id.to_s,
        current_user_id: user.id.to_s,
      )

      expect(result).to be_success
      value = result.value!

      expect(value[:latest_seq]).to eq(42)
      expect(value[:snapshot_id]).to be_present
      expect(value[:totals][:transactions]).to be >= 1
      expect(value[:totals][:truncated]).to be(false)
      expect(value[:accounts]).to include(:accounts)
      expect(value[:categories]).to include(:expense_categories, :income_categories)
      expect(value[:tags]).to be_an(Array)
      expect(value[:entities]).to be_an(Array)
      expect(value[:transactions]).to be_an(Array)
      expect(value[:monthly_financial_summaries]).to be_an(Array)
      expect(value[:loans]).to be_an(Array)
      expect(value[:budgets_by_month]).to be_a(Hash)
      expect(value[:space]).to include(id: space.id)
      expect(value[:dashboard_shell]).to include(
        :goal_description,
        :category_options,
        :account_options,
      )
    end

    it "fails when the space does not exist" do
      result = described_class.new.call(space_id: SecureRandom.uuid)

      expect(result).to be_failure
      expect(result.failure).to include(space_id: "not found")
    end
  end
end
