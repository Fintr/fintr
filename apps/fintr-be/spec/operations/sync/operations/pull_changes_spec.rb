# frozen_string_literal: true

require "rails_helper"

RSpec.describe Sync::Operations::PullChanges do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }

  def append_log(seq:, op: "transaction.created", created_at: Time.current)
    Sync::SpaceSequence.find_or_create_by!(space_id: space.id) do |row|
      row.last_seq = 0
    end.update!(last_seq: seq)

    Sync::ChangeLogEntry.create!(
      space_id: space.id,
      seq:,
      op:,
      payload: {
        "transactions" => [
          {
            "id" => SecureRandom.uuid,
            "description" => "Peer change seq #{seq}",
          },
        ],
      },
      created_at:,
      updated_at: created_at,
    )
  end

  describe "100-day offline scenario" do
    before do
      # Days 1–10 peer changes (seq 1001–1010) — expired by TTL trim
      10.times do |index|
        append_log(
          seq: 1001 + index,
          created_at: 110.days.ago + index.days,
        )
      end

      # Simulate retention trim: only seq 5000+ remain (post day-90 window)
      Sync::ChangeLogEntry.where(space_id: space.id).where("seq < ?", 5000).delete_all
      Sync::SpaceSequence.find_by!(space_id: space.id).update!(last_seq: 5002)

      append_log(seq: 5000, created_at: 1.day.ago)
      append_log(seq: 5001, created_at: 12.hours.ago)
      append_log(seq: 5002, created_at: 1.hour.ago)
    end

    it "returns bootstrap_required when since is before oldest retained seq" do
      result = operation.call(space_id: space.id.to_s, since: 1000)

      expect(result).to be_failure
      expect(result.failure[:bootstrap_required]).to be(true)
      expect(result.failure[:oldest_available_seq]).to eq(5000)
    end

    it "does not return expired day 1–10 changes when since is 1000" do
      result = operation.call(space_id: space.id.to_s, since: 1000)

      expect(result).to be_failure
    end

    it "returns retained changes when since is at oldest available seq" do
      result = operation.call(space_id: space.id.to_s, since: 5000)

      expect(result).to be_success
      expect(result.value![:changes].map(&:seq)).to eq([5001, 5002])
    end

    it "returns all retained changes when since is 0 but log starts at 5000" do
      result = operation.call(space_id: space.id.to_s, since: 0)

      expect(result).to be_success
      expect(result.value![:changes].map(&:seq)).to eq([5000, 5001, 5002])
    end
  end
end
