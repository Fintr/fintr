# frozen_string_literal: true

require "rails_helper"

RSpec.describe Spaces::Space, type: :model do
  describe "#member_count" do
    let(:space) { create(:personal_space) }
    let(:user) { create(:user) }

    it "counts joined members only" do
      create(:space_user, space:, user:)
      create(
        :space_user,
        space:,
        user: nil,
        invitation_status: "pending",
        access_code: "ABC123XYABCDEF",
        invited_by: user,
        invitation_expires_at: 7.days.from_now,
      )

      expect(space.member_count).to eq(1)
    end
  end

  describe "#composition_key" do
    let(:space) { create(:personal_space) }

    it "returns solo for one member" do
      create(:space_user, space:, user: create(:user))
      expect(space.composition_key).to eq("solo")
    end

    it "returns couple for two members" do
      create(:space_user, space:, user: create(:user))
      create(:space_user, space:, user: create(:user))
      expect(space.composition_key).to eq("couple")
    end

    it "returns household for three or more members" do
      3.times { create(:space_user, space:, user: create(:user)) }
      expect(space.composition_key).to eq("household")
    end
  end
end
