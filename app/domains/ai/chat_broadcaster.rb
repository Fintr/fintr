# frozen_string_literal: true

module Ai
  # Broadcasts chat updates via Action Cable
  # Single Responsibility: Broadcasting chat messages
  class ChatBroadcaster
    CHANNEL = 'chat'

    def initialize(channel: nil)
      @channel = channel || CHANNEL
    end

    # Broadcast a chunk of streaming response
    # @param conversation_id [String]
    # @param chunk [String]
    def chunk(
      conversation_id,
      chunk
    )
      broadcast(
        conversation_id,
        {
          status: 'streaming',
          content: chunk,
        },
      )
    end

    # Broadcast metadata about the response
    # @param conversation_id [String]
    # @param metadata [Hash]
    def metadata(
      conversation_id,
      metadata
    )
      broadcast(
        conversation_id,
        {
          status: 'processing',
          metadata: metadata,
        },
      )
    end

    # Broadcast completion
    # @param conversation_id [String]
    # @param content [String]
    def complete(
      conversation_id,
      content
    )
      broadcast(
        conversation_id,
        {
          status: 'complete',
          content: content,
        },
      )
    end

    # Broadcast an error
    # @param conversation_id [String]
    # @param error [String]
    # @param code [String, nil]
    def error(
      conversation_id,
      error,
      code: nil
    )
      broadcast(
        conversation_id,
        {
          status: 'error',
          error: error,
          error_code: code,
        },
      )
    end

    private

    def broadcast(
      conversation_id,
      payload
    )
      ActionCable.server.broadcast(
        "#{@channel}_#{conversation_id}",
        payload,
      )
    end
  end
end
