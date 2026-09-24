# frozen_string_literal: true

module Fintr
  module Domain
    # Shared domain constants mirrored by @fintr/domain (packages/fintr-domain).
    # Keep in sync with packages/fintr-domain/src/primitives.ts and parity fixtures.
    module Constants
      SCHEDULE_TYPES = %w[one_time repeat installment].freeze
      TRANSFER_SCHEDULE_TYPES = %w[one_time repeat].freeze
      TRANSACTION_TYPES = %w[income expense].freeze

      REPEAT_INTERVALS = %w[
        every_day
        every_week
        every_2_weeks
        every_month
        every_2_months
        every_3_months
        every_6_months
        every_year
      ].freeze

      EXCHANGE_RATE_SOURCES = %w[auto manual recent].freeze
      DELETE_SCOPES = %w[this_only this_and_future all_in_series].freeze
      UPDATE_SCOPES = DELETE_SCOPES
    end
  end
end
