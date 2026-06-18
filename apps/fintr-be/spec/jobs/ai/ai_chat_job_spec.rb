# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::AiChatJob, type: :job do
  # TODO: Update tests after AI chat job refactoring
  # The job orchestrates ChatBroadcaster, InteractionTracker,
  # Conversations::ConversationService, and the agentic RAG agent.

  it "exists as a job class" do
    expect(described_class).to be < ApplicationJob
  end
end
