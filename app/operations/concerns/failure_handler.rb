module Concerns
  module FailureHandler
    extend ActiveSupport::Concern

    def on_failure(failure)
      case failure
      in Hash => hash
        errors_hash = hash.except(:error)
        new_hash = { errors: errors_hash, error: hash[:error] }
      end
    end
  end
end
