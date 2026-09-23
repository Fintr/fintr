# frozen_string_literal: true

require "digest"

module Finance
  module Operations
    module Revenuecat
      class HandleWebhook < Dry::Operation
        def call(authorization:, payload:)
          step authorize(authorization:)
          user_id = step app_user_id(payload:)
          step sync_user(user_id:)
        end

        private

        def authorize(authorization:)
          expected = ENV["REVENUECAT_WEBHOOK_AUTHORIZATION"].to_s
          return Failure(unauthorized: true) if expected.blank?

          provided = authorization.to_s
          candidates = [
            provided,
            provided.delete_prefix("Bearer ").strip,
          ]
          allowed = candidates.any? { |candidate| secure_match?(candidate, expected) }
          return Failure(unauthorized: true) unless allowed

          Success(true)
        end

        def secure_match?(candidate, expected)
          ActiveSupport::SecurityUtils.secure_compare(
            Digest::SHA256.hexdigest(candidate),
            Digest::SHA256.hexdigest(expected),
          )
        end

        def app_user_id(payload:)
          event = payload["event"] || payload[:event] || {}
          user_id = event["app_user_id"] || event[:app_user_id]
          return Failure(app_user_id: ["is required"]) if user_id.blank?

          Success(user_id.to_s)
        end

        def sync_user(user_id:)
          return Success(ignored: true) unless Auth::User.exists?(id: user_id)

          SyncCustomer.new.call(user_id:)
        end
      end
    end
  end
end
