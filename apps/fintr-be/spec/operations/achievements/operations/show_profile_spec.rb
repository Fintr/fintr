# frozen_string_literal: true

require "rails_helper"

RSpec.describe Achievements::Operations::ShowProfile, type: :operation do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, owner: user) }

  before do
    create(:space_user, user:, space:)
  end

  describe "#call" do
    it "returns the Rookie Tracker title at level 1" do
      result = described_class.new.call(
        user_id: user.id,
        space_id: space.id,
      )

      expect(result).to be_success
      expect(result.value![:title][:key]).to eq("rookie_tracker")
      expect(result.value![:title][:title]).to eq("Rookie Tracker")
    end

    it "includes the full title ladder" do
      result = described_class.new.call(
        user_id: user.id,
        space_id: space.id,
      )

      expect(result.value![:titles].size).to eq(10)
      expect(result.value![:titles].first[:unlocked]).to be true
      expect(result.value![:titles].find { |t| t[:key] == "super_saver" }[:unlocked]).to be false
    end

    it "returns Fierce Budgeter when level is 4" do
      Achievements::UserGamificationStat.create!(
        user_id: user.id,
        xp: 300,
        level: 4,
      )

      result = described_class.new.call(user_id: user.id)

      expect(result.value![:title][:title]).to eq("Fierce Budgeter")
    end

    it "returns Super Saver when level is 5" do
      Achievements::UserGamificationStat.create!(
        user_id: user.id,
        xp: 400,
        level: 5,
      )

      result = described_class.new.call(user_id: user.id)

      expect(result.value![:title][:title]).to eq("Super Saver")
    end
  end
end
