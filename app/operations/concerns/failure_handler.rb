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

# Custom exception for operation failures without underlying exceptions
class OperationFailure < StandardError
  attr_reader :errors_hash, :operation_class, :is_expected

  def initialize(errors_hash:, operation_class:, is_expected:, backtrace: nil)
    @errors_hash = errors_hash
    @operation_class = operation_class
    @is_expected = is_expected
    message = "Operation Failure: #{operation_class}"
    super(message)

    # Set the backtrace to show where the operation failed
    # If backtrace is provided, use it; otherwise capture from caller
    # Skip 2 frames: this initialize method and on_failure method
    if backtrace
      set_backtrace(backtrace)
    else
      captured_backtrace = caller(2..-1) # Skip initialize and on_failure
      set_backtrace(captured_backtrace) if captured_backtrace.any?
    end
  end
end

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
        level = is_expected ? :warning : :error
        Sentry.capture_exception(error, level: level) do |scope|
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
      elsif errors_hash.present?
        # Report failures without exceptions (validation errors, not found, etc.)
        # Create a custom exception to track these as exceptions in Sentry
        # Capture backtrace from caller to show where the failure occurred
        # Skip 1 frame (this on_failure method) to get the actual call path
        failure_backtrace = caller(1..-1)

        operation_failure = OperationFailure.new(
          errors_hash: errors_hash,
          operation_class: self.class.name,
          is_expected: is_expected,
          backtrace: failure_backtrace
        )

        level = is_expected ? :warning : :error
        Sentry.capture_exception(operation_failure, level: level) do |scope|
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
