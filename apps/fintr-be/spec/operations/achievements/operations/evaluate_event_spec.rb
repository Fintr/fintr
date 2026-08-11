# frozen_string_literal: true

require "rails_helper"

RSpec.describe Achievements::Operations::EvaluateEvent, type: :operation do
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
  end

  describe "#call" do
    context "when the user has a transaction in the space" do
      before do
        create(:expense_transaction, user:, space:)
      end

      it "unlocks the penny_pioneer achievement" do
        result = described_class.new.call(
          user_id: user.id,
          space_id: space.id,
          event: "transaction_created",
        )

        expect(result).to be_success
        expect(result.value!.map { |ua| ua.achievement.key }).to include("penny_pioneer")
      end

      it "awards xp to the user" do
        described_class.new.call(
          user_id: user.id,
          space_id: space.id,
          event: "transaction_created",
        )

        stats = Achievements::UserGamificationStat.find_by(user_id: user.id)
        expect(stats.xp).to eq(40)
      end
    end

    context "when the achievement was already unlocked" do
      before do
        create(:expense_transaction, user:, space:)
        described_class.new.call(
          user_id: user.id,
          space_id: space.id,
          event: "transaction_created",
        )
      end

      it "does not unlock again" do
        result = described_class.new.call(
          user_id: user.id,
          space_id: space.id,
          event: "transaction_created",
        )

        expect(result).to be_success
        expect(result.value!).to eq([])
      end
    end
  end
end
