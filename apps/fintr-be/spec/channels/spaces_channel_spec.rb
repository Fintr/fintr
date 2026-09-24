# frozen_string_literal: true

require "rails_helper"

RSpec.describe SpacesChannel, type: :channel do
  let(:user) { create(:user) }
  let(:other_user) { create(:user) }
  let(:space) { create(:personal_space) }

  before do
    create(:space_user, user:, space:)
    stub_connection(current_user: user)
  end

  describe "#subscribed" do
    it "rejects when space_id is missing" do
      subscribe

      expect(subscription).to be_rejected
    end

    it "rejects when the user is not a space member" do
      stub_connection(current_user: other_user)
      subscribe(space_id: space.id)

      expect(subscription).to be_rejected
    end

    it "streams from the space settings channel" do
      subscribe(space_id: space.id)

      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_from("spaces:#{space.id}")
    end

    it "accepts space code as space_id" do
      subscribe(space_id: space.code)

      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_from("spaces:#{space.id}")
    end
  end
end
