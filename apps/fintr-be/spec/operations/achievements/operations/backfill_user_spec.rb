# frozen_string_literal: true

require "rails_helper"

RSpec.describe Achievements::Operations::BackfillUser, type: :operation do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, owner: user) }

  before do
    create(:space_user, user:, space:)
    Achievements::Achievement.find_or_create_by!(key: "penny_pioneer") do |a|
      a.title = "Penny Pioneer"
      a.description = "Logged your first income or expense."
      a.xp_reward = 40
      a.rarity = "common"
      a.kind = "collectible"
      a.image_key = "penny_pioneer"
      a.unlock_event = "transaction_created"
      a.unlock_threshold = { "min_count" => 1 }
      a.active = true
    end
    Achievements::Achievement.find_or_create_by!(key: "budget_beast") do |a|
      a.title = "Budget Beast"
      a.description = "Created a budget."
      a.xp_reward = 70
      a.rarity = "uncommon"
      a.kind = "collectible"
      a.image_key = "budget_beast"
      a.unlock_event = "budget_created"
      a.unlock_threshold = {}
      a.active = true
    end
  end

  describe "#call" do
    context "when the user already has qualifying history" do
      before do
        create(:expense_transaction, user:, space:)
        create(:budget, space:)
      end

      it "unlocks badges they already earned" do
        result = described_class.new.call(user_id: user.id)

        expect(result).to be_success
        keys = result.value!.map { |ua| ua.achievement.key }
        expect(keys).to include("penny_pioneer", "budget_beast")
      end

      it "awards xp for unlocked badges" do
        described_class.new.call(user_id: user.id)

        stats = Achievements::UserGamificationStat.find_by!(user_id: user.id)
        expect(stats.xp).to eq(110)
        expect(stats.backfilled_at).to be_present
      end

      it "does not unlock again on a second run" do
        described_class.new.call(user_id: user.id)
        result = described_class.new.call(user_id: user.id)

        expect(result).to be_success
        expect(result.value!).to eq([])
      end
    end

    context "when the user has no qualifying history" do
      it "marks backfill complete without unlocks" do
        result = described_class.new.call(user_id: user.id)

        expect(result).to be_success
        expect(result.value!).to eq([])
        expect(
          Achievements::UserGamificationStat.find_by!(user_id: user.id).backfilled_at,
        ).to be_present
      end
    end
  end
end
