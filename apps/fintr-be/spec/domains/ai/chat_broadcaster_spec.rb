# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::ChatBroadcaster do
  describe "#agent_step" do
    it "broadcasts processing status with the agent step payload" do
      broadcaster = described_class.new
      conversation_id = "conv-123"
      step = { kind: "search_transactions", label: "Searching: groceries" }

      expect(ActionCable.server).to receive(:broadcast).with(
        "chat_#{conversation_id}",
        {
          status: "processing",
          agent_step: step,
        },
      )

      broadcaster.agent_step(conversation_id, step)
    end
  end
end
