# frozen_string_literal: true

require 'rails_helper'

# TODO: Rewrite AI chat integration tests after job refactoring
# The job has been completely refactored to use service objects:
# - ChatBroadcaster, InteractionTracker, Conversations::ConversationService, Ai::Rag::RagPipeline
# Integration tests should be rewritten to test the actual integration with proper mocking.
# rubocop:disable RSpec/SpecFilePathFormat
RSpec.describe Ai::AiChatJob, type: :integration do
  it "exists as a job class" do
    expect(described_class).to be < ApplicationJob
  end
end
