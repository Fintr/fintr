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
      DEFAULT_REQUEST_TIMEOUT_SECONDS = 12

      # No trailing /v1 — ruby-openai appends /v1/ to uri_base
      OPENROUTER_URI_BASE = "https://openrouter.ai/api"

      class << self
        def openrouter?
          case ENV["AI_VISION_PROVIDER"].to_s.strip.downcase
          when PROVIDER_OPENAI
            false
          when PROVIDER_OPENROUTER
            ENV["OPENROUTER_API_KEY"].present?
          else
            ENV["OPENROUTER_API_KEY"].present?
          end
        end

        def request_timeout_seconds
          raw = ENV["AI_VISION_REQUEST_TIMEOUT"].to_s.strip
          return DEFAULT_REQUEST_TIMEOUT_SECONDS if raw.blank?

          seconds = raw.to_i
          seconds.positive? ? seconds : DEFAULT_REQUEST_TIMEOUT_SECONDS
        end

        # OpenRouter-only: route to the lowest-latency provider for the model.
        def openrouter_chat_extras
          return {} unless openrouter?

          {
            provider: {
              sort: "latency"
            }
          }
        end
        # Returns an OpenAI-compatible client (either OpenAI or OpenRouter).
        # Use for chat completions with vision (e.g. receipt/document extraction).
        def client
          timeout = request_timeout_seconds

          if openrouter?
            OpenAI::Client.new(
              access_token: ENV.fetch("OPENROUTER_API_KEY"),
              uri_base: OPENROUTER_URI_BASE,
              request_timeout: timeout,
            )
          else
            OpenAI::Client.new(
              access_token: ENV["OPENAI_API_KEY"] || Rails.application.credentials.openai_api_key,
              request_timeout: timeout,
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

        def default_model
          openrouter? ? OPENROUTER_DEFAULT_MODEL : OPENAI_DEFAULT_MODEL
        end
      end
    end
  end
end
