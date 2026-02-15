# frozen_string_literal: true

module Ai
  module Llm
    # Plug-and-play vision client for document/receipt extraction.
    # OLD way: OpenAI GPT-4o (set AI_VISION_PROVIDER=openai or only OPENAI_API_KEY).
    # NEW way: OpenRouter + Gemini 2.0 Flash (set OPENROUTER_API_KEY, optional AI_VISION_PROVIDER=openrouter).
    class VisionClient
      PROVIDER_OPENAI    = "openai"
      PROVIDER_OPENROUTER = "openrouter"

      OPENAI_DEFAULT_MODEL    = "gpt-4o"
      OPENROUTER_DEFAULT_MODEL = "google/gemini-2.5-flash-lite"

      # No trailing /v1 — ruby-openai appends /v1/ to uri_base
      OPENROUTER_URI_BASE = "https://openrouter.ai/api"

      class << self
        # Returns an OpenAI-compatible client (either OpenAI or OpenRouter).
        # Use for chat completions with vision (e.g. receipt/document extraction).
        def client
          if openrouter?
            OpenAI::Client.new(
              access_token: ENV.fetch("OPENROUTER_API_KEY"),
              uri_base:     OPENROUTER_URI_BASE
            )
          else
            OpenAI::Client.new(
              access_token: ENV["OPENAI_API_KEY"] || Rails.application.credentials.openai_api_key
            )
          end
        end

        # Model name to use for vision (chat completions).
        # Override with AI_VISION_MODEL if set.
        def model
          ENV["AI_VISION_MODEL"].presence || default_model
        end

        # Current provider in use (for logging/debugging).
        def provider
          openrouter? ? PROVIDER_OPENROUTER : PROVIDER_OPENAI
        end

        private

        def openrouter?
          case ENV["AI_VISION_PROVIDER"].to_s.strip.downcase
          when PROVIDER_OPENAI
            false
          when PROVIDER_OPENROUTER
            ENV["OPENROUTER_API_KEY"].present?
          else
            # Default: use OpenRouter if key is set, else OpenAI (old way)
            ENV["OPENROUTER_API_KEY"].present?
          end
        end

        def default_model
          openrouter? ? OPENROUTER_DEFAULT_MODEL : OPENAI_DEFAULT_MODEL
        end
      end
    end
  end
end
