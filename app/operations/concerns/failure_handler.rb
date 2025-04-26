# frozen_string_literal: true

module Concerns
  module FailureHandler
    extend ActiveSupport::Concern

    def on_failure(failure)
      case failure
      in Hash => hash
        errors_hash = hash.except(:error)
        new_hash = { errors: errors_hash, error: hash[:error] }
        Sentry.capture_exception(hash[:error]) if hash[:error].is_a?(StandardError)
        Rails.logger.error(new_hash)
      end
    end
  end
end
