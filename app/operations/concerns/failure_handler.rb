# frozen_string_literal: true

# Railway Oriented Programming (ROP) failure handler
# Reports ALL failures to Sentry with appropriate tags for filtering and analysis
# Distinguishes between expected failures (business logic) and unexpected failures (bugs)
#
# Benefits of all reporting:
# - Identifies systemic issues and patterns
# - Enables root cause analysis on all failure types
# - Prevents future errors through comprehensive visibility
# - Fosters transparency and learning culture
#
# Usage:
#   # Expected failure (no exception)
#   return Failure(account_name: "not found") unless account
#
#   # Expected failure with exception (user input validation)
#   rescue ActiveRecord::RecordInvalid => e
#     Failure(errors: record.errors.to_hash, error: e, expected: true)
#
#   # DO NOT rescue StandardError - let unexpected errors bubble up
#   # Only rescue specific exceptions you expect (RecordInvalid, RecordNotFound, etc.)
#
# Or use helper methods:
#   return expected_failure(account_name: "not found")
#   return unexpected_failure({ operation: "failed" }, error: e)
module FailureHandler
  extend ActiveSupport::Concern

  def on_failure(failure)
    case failure
    in Hash => hash
      errors_hash = hash.except(:error, :expected)
      new_hash = { errors: errors_hash, error: hash[:error] }

      error = hash[:error]
      is_expected = hash.fetch(:expected, false)
      failure_type = is_expected ? "expected" : "unexpected"

      # Report ALL failures to Sentry with appropriate tags
      if error.is_a?(StandardError)
        Sentry.capture_exception(error) do |scope|
          scope.set_tags(
            operation: self.class.name,
            failure_type: failure_type,
            expected: is_expected
          )
          scope.set_context("failure_details", {
            errors: errors_hash,
            is_expected: is_expected,
            operation_class: self.class.name
          })
          scope.level = is_expected ? :warning : :error
        end
      elsif errors_hash.present?
        # Report failures without exceptions (validation errors, not found, etc.)
        Sentry.capture_message(
          "Operation Failure: #{self.class.name}",
          level: is_expected ? :warning : :error
        ) do |scope|
          scope.set_tags(
            operation: self.class.name,
            failure_type: failure_type,
            expected: is_expected
          )
          scope.set_context("failure_details", {
            errors: errors_hash,
            is_expected: is_expected,
            operation_class: self.class.name
          })
        end
      end

      log_level = is_expected ? :warn : :error
      Rails.logger.public_send(log_level, "[#{self.class.name}] #{new_hash}")
    end
  end

  def expected_failure(errors, error: nil)
    Failure(errors.merge(error: error, expected: true))
  end

  def unexpected_failure(errors, error: nil)
    Failure(errors.merge(error: error, expected: false))
  end
end
