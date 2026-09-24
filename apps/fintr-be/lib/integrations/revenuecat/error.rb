# frozen_string_literal: true

module Integrations
  module Revenuecat
    class Error < StandardError
      attr_reader :status, :body, :retryable, :backoff_ms

      def initialize(message:, status:, body: nil, retryable: false, backoff_ms: nil)
        super(message)
        @status = status
        @body = body
        @retryable = retryable
        @backoff_ms = backoff_ms
      end
    end

    class NotFound < Error
      def initialize(message: "RevenueCat customer was not found", body: nil)
        super(message:, status: 404, body:)
      end
    end

    class NotConfigured < Error
      def initialize(message:)
        super(message:, status: nil)
      end
    end
  end
end
