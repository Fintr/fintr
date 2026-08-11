# frozen_string_literal: true

require "rails_helper"

RSpec.describe TransactionEditingChannel, type: :channel do
  let(:user) do
    create(
      :user,
      full_name: "Miguel Editor",
      photo_url: "https://example.com/miguel.jpg",
    )
  end
  let(:other_user) { create(:user, full_name: "Other Editor") }
  let(:space) { create(:personal_space) }
  let(:transaction_id) { SecureRandom.uuid }

  before do
    create(:space_user, user:, space:)
    stub_connection(current_user: user)
    TransactionEditing::PresenceRegistry.reset_for_tests!
  end

  after do
    TransactionEditing::PresenceRegistry.reset_for_tests!
  end

  describe "#subscribed" do
    it "rejects when space_id is missing" do
      subscribe(transaction_id:)

      expect(subscription).to be_rejected
    end

    it "rejects when the user is not a space member" do
      stub_connection(current_user: other_user)
      subscribe(space_id: space.id, transaction_id:)

      expect(subscription).to be_rejected
    end

    it "streams from the space+transaction presence channel" do
      subscribe(space_id: space.id, transaction_id:)

      expect(subscription).to be_confirmed
      expect(subscription).to have_stream_from(
        "transaction_editing:#{space.id}:#{transaction_id}",
      )
    end

    it "broadcasts the current editors list on subscribe" do
      expect do
        subscribe(space_id: space.id, transaction_id:)
      end.to have_broadcasted_to(
        "transaction_editing:#{space.id}:#{transaction_id}",
      ).with(
        hash_including(
          type: "editors",
          editors: array_including(
            hash_including(
              "userId" => user.id.to_s,
              "fullName" => "Miguel Editor",
              "photoUrl" => "https://example.com/miguel.jpg",
            ),
          ),
        ),
      )
    end
  end

  describe "#start_editing" do
    it "preserves the original startedAt when the same user starts again" do
      subscribe(space_id: space.id, transaction_id:)
      original_started_at = TransactionEditing::PresenceRegistry.editors(
        space_id: space.id.to_s,
        transaction_id:,
      ).first.fetch("startedAt")

      travel 5.seconds do
        perform :start_editing
      end

      editors = TransactionEditing::PresenceRegistry.editors(
        space_id: space.id.to_s,
        transaction_id:,
      )

      expect(editors.first.fetch("startedAt")).to eq(original_started_at)
    end
  end

  describe "#unsubscribed" do
    it "removes the editor and rebroadcasts" do
      subscribe(space_id: space.id, transaction_id:)

      expect do
        unsubscribe
      end.to have_broadcasted_to(
        "transaction_editing:#{space.id}:#{transaction_id}",
      ).with(
        hash_including(
          type: "editors",
          editors: [],
        ),
      )
    end
  end
end
