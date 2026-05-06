# frozen_string_literal: true

module Integrations
  module Payments
    module Xendit
      class Error < StandardError
        attr_reader :status, :code, :xendit_response

        def initialize(message:, status: nil, code: nil, xendit_response: nil)
          super(message)
          @status = status
          @code = code
          @xendit_response = xendit_response
        end

        def self.from_response(response_body:, status:)
          parsed = response_body.is_a?(Hash) ? response_body : JSON.parse(response_body)
          error_message = parsed["message"] || parsed["error"] || "Xendit API error"
          error_code = parsed["error_code"] || parsed["code"]

          new(
            message: error_message,
            status: status,
            code: error_code,
            xendit_response: parsed
          )
        rescue JSON::ParserError
          new(
            message: "Xendit API error (HTTP #{status})",
            status: status,
            xendit_response: response_body
          )
        end
      end
    end
  end
end
