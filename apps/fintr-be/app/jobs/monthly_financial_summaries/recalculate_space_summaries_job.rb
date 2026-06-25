# frozen_string_literal: true

module MonthlyFinancialSummaries
  class RecalculateSpaceSummariesJob < ApplicationJob
    queue_as :default

    limits_concurrency to: 1,
                       key: ->(space_id:) { "monthly_financial_summaries/recalculate_space/#{space_id}" },
                       duration: 30.minutes

    def perform(space_id:)
      result = MonthlyFinancialSummaries::Operations::RecalculateSpaceSummaries.new.call(
        space_id:
      )
      if result.success?
        data = result.value!
        Rails.logger.info(
          "[MonthlyFinancialSummaries::RecalculateSpaceSummariesJob] " \
          "Recalculated #{data[:months_recalculated]} month(s) for space #{space_id} " \
          "in #{data[:currency]}"
        )
        return
      end

      Rails.logger.warn(
        "[MonthlyFinancialSummaries::RecalculateSpaceSummariesJob] Failed for space #{space_id}: " \
        "#{result.failure.inspect}"
      )
    end
  end
end
