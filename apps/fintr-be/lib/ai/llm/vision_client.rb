# frozen_string_literal: true

require "base64"
require "tempfile"

module Ai
  module Llm
    # Receipt vision chat through RubyLLM's OpenRouter provider.
    # Pass a file path or a data URL. Bare Gemini ids get the OpenRouter `google/` prefix.
    class VisionClient
      PROVIDER = :openrouter
      DEFAULT_MODEL = "google/gemini-2.5-flash-lite"
      DEFAULT_REQUEST_TIMEOUT_SECONDS = 12

      class << self
        def provider
          PROVIDER
        end

        def model
          raw = ENV["AI_VISION_MODEL"].presence || DEFAULT_MODEL
          return raw if raw.include?("/")

          "google/#{raw}"
        end

        def request_timeout_seconds
          raw = ENV["AI_VISION_REQUEST_TIMEOUT"].to_s.strip
          return DEFAULT_REQUEST_TIMEOUT_SECONDS if raw.blank?

          seconds = raw.to_i
          seconds.positive? ? seconds : DEFAULT_REQUEST_TIMEOUT_SECONDS
        end

        def ask(
          instructions:,
          prompt:,
          image:,
          max_output_tokens:
        )
          attachment = nil
          attachment = attachment_for(image:)
          message = vision_chat(max_output_tokens:).ask(
            "#{instructions}\n\n#{prompt}",
            with: [attachment],
          )
          message_text(message)
        ensure
          release_attachment(attachment)
        end

        private

        def vision_chat(max_output_tokens:)
          context = RubyLLM.context do |config|
            config.request_timeout = request_timeout_seconds
          end

          context.chat(
            model: model,
            provider: provider,
            assume_model_exists: true,
          )
            .with_temperature(0.0)
            .with_params(
              max_tokens: max_output_tokens,
              provider: {
                sort: "latency"
              },
            )
        end

        def message_text(message)
          content = message.content
          text = content.respond_to?(:text) ? content.text : content
          text.to_s.strip
        end

        def attachment_for(image:)
          return image unless data_url?(image)

          header, encoded = image.split(",", 2)
          file = Tempfile.new(["receipt-vision", extension_for(header)])
          file.binmode
          file.write(Base64.strict_decode64(encoded.to_s))
          file.rewind
          file
        end

        def data_url?(image)
          image.is_a?(String) && image.start_with?("data:")
        end

        def extension_for(header)
          subtype = header.to_s[%r{image/([a-z0-9.+-]+)}i, 1]
          return ".jpg" if subtype.blank?

          ".#{subtype.split('+').first}"
        end

        def release_attachment(attachment)
          return unless attachment.is_a?(Tempfile)

          attachment.close
          attachment.unlink
        end
      end
    end
  end
end
