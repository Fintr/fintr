# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Broadcasts::CategoryChange do
  let(:space) { create(:personal_space) }
  let(:actor) { create(:user, full_name: "Alex Actor") }
  let!(:category) do
    create(
      :category,
      space:,
      name: "Transportation",
      category_type: "expense",
      icon: "car",
      color: "#ff0000",
    )
  end

  describe ".updated" do
    it "appends to space_change_log and broadcasts sync_change with category payload" do
      expect do
        described_class.updated(category:, actor:)
      end.to change(Sync::ChangeLogEntry, :count).by(1)
        .and have_broadcasted_to("transactions:#{space.id}").with(
          hash_including(
            type: "sync_change",
            seq: 1,
            op: "category.updated",
            spaceId: space.id.to_s,
            payload: hash_including(
              category: hash_including(
                id: category.id.to_s,
                name: "Transportation",
                icon: "car",
                color: "#ff0000",
                categoryType: "expense",
              ),
            ),
            actor: hash_including(
              userId: actor.id.to_s,
              fullName: "Alex Actor",
            ),
          ),
        )

      entry = Sync::ChangeLogEntry.find_by!(space_id: space.id, seq: 1)
      expect(entry.op).to eq("category.updated")
      expect(entry.entity_id).to eq(category.id.to_s)
    end
  end
end
