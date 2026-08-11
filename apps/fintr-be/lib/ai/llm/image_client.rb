# frozen_string_literal: true

require "json"
require "net/http"

module Ai
  module Llm
    # OpenRouter Image API client for text-to-image generation.
    class ImageClient
      OPENROUTER_IMAGES_URI = "https://openrouter.ai/api/v1/images"
      DEFAULT_MODEL = "bytedance-seed/seedream-4.5"
      DEFAULT_TIMEOUT_SECONDS = 120

      class Error < StandardError; end

      class << self
        def generate(prompt:)
          api_key = ENV["OPENROUTER_API_KEY"]
          raise Error, "OpenRouter API key not configured" if api_key.blank?

          uri = URI(OPENROUTER_IMAGES_URI)
          http = Net::HTTP.new(uri.host, uri.port)
          http.use_ssl = true
          http.read_timeout = request_timeout_seconds
          http.open_timeout = request_timeout_seconds

          request = Net::HTTP::Post.new(uri)
          request["Authorization"] = "Bearer #{api_key}"
          request["Content-Type"] = "application/json"
          request["HTTP-Referer"] = OpenRouter.site_url
          request["X-Title"] = OpenRouter.site_name
          request.body = build_body(prompt:).to_json

          response = http.request(request)
          parse_response(response)
        end

        def model
          ENV["AI_IMAGE_MODEL"].presence || DEFAULT_MODEL
        end

        private

        def request_timeout_seconds
          raw = ENV["AI_IMAGE_REQUEST_TIMEOUT"].to_s.strip
          return DEFAULT_TIMEOUT_SECONDS if raw.blank?

          seconds = raw.to_i
          seconds.positive? ? seconds : DEFAULT_TIMEOUT_SECONDS
        end

        def build_body(prompt:)
          {
            model: model,
            prompt: prompt,
            aspect_ratio: "16:9",
            output_format: "png",
            n: 1,
            provider: {
              sort: "latency",
            },
          }
        end

        def parse_response(response)
          body = JSON.parse(response.body)

          unless response.is_a?(Net::HTTPSuccess)
            message = body.dig("error", "message") || body["message"] || response.message
            raise Error, message
          end

          b64_json = body.dig("data", 0, "b64_json")
          raise Error, "Image generation returned no data" if b64_json.blank?

          b64_json
        end
      end
    end
  end
end
