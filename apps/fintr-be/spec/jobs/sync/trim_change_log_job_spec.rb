# frozen_string_literal: true

require "rails_helper"

RSpec.describe Sync::TrimChangeLogJob, type: :job do
  let(:space) { create(:personal_space) }

  it "deletes change log rows older than 90 days" do
    Sync::SpaceSequence.create!(space_id: space.id, last_seq: 2)

    Sync::ChangeLogEntry.create!(
      space_id: space.id,
      seq: 1,
      op: "transaction.created",
      payload: { "transaction" => { "id" => SecureRandom.uuid } },
      created_at: 100.days.ago,
      updated_at: 100.days.ago,
    )

    retained = Sync::ChangeLogEntry.create!(
      space_id: space.id,
      seq: 2,
      op: "transaction.created",
      payload: { "transaction" => { "id" => SecureRandom.uuid } },
      created_at: 1.day.ago,
      updated_at: 1.day.ago,
    )

    described_class.perform_now

    expect(Sync::ChangeLogEntry.where(space_id: space.id).pluck(:id)).to eq([retained.id])
  end
end
