# frozen_string_literal: true

require "rails_helper"

RSpec.describe Spaces::Broadcasts::SettingsChange do
  let(:space) { create(:personal_space, currency: "PHP") }
  let(:actor) do
    create(
      :user,
      full_name: "Alex Actor",
      photo_url: "https://example.com/alex.png",
    )
  end

  describe ".stream_key" do
    it "uses the space id" do
      expect(described_class.stream_key(space_id: space.id)).to eq(
        "spaces:#{space.id}",
      )
    end
  end

  describe ".currency_changed" do
    it "appends to space_change_log and broadcasts sync_change with settings payload" do
      expect do
        described_class.currency_changed(
          space:,
          actor:,
          currency: "USD",
          default_transaction_currency: "EUR",
        )
      end.to change(Sync::ChangeLogEntry, :count).by(1)
        .and have_broadcasted_to("spaces:#{space.id}").with(
          hash_including(
            type: "sync_change",
            seq: 1,
            op: "space.settings.updated",
            spaceId: space.id.to_s,
            payload: hash_including(
              currency: "USD",
              spaceId: space.id.to_s,
              defaultTransactionCurrency: "EUR",
            ),
            actor: hash_including(
              userId: actor.id.to_s,
              authId: actor.auth_id.to_s,
              fullName: "Alex Actor",
              photoUrl: "https://example.com/alex.png",
            ),
          ),
        )

      entry = Sync::ChangeLogEntry.find_by!(space_id: space.id, seq: 1)
      expect(entry.op).to eq("space.settings.updated")
      expect(entry.payload["currency"]).to eq("USD")
    end

    it "includes originTabId when Current.client_tab_id is set" do
      Current.client_tab_id = "tab-settings-1"

      expect do
        described_class.currency_changed(
          space:,
          actor:,
          currency: "USD",
        )
      end.to have_broadcasted_to("spaces:#{space.id}").with(
        hash_including(
          type: "sync_change",
          originTabId: "tab-settings-1",
        ),
      )
    ensure
      Current.reset
    end
  end
end
