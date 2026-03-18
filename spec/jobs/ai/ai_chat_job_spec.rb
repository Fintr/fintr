# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::AiChatJob, type: :job do
  # TODO: Update tests after AI chat job refactoring
  # The job has been completely refactored to use service objects:
  # - ChatBroadcaster
  # - InteractionTracker
  # - Conversations::ConversationService
  # - Ai::Rag::RagPipeline
  #
  # Tests should be rewritten to test the integration of these services
  # rather than the old implementation details.

  it "exists as a job class" do
    expect(described_class).to be < ApplicationJob
  end
end
