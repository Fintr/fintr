# frozen_string_literal: true

module Budgets
  class CreateMonthlyBudgetsJob < ApplicationJob
    queue_as :default

    def perform(space_id:, date:)
      Rails.logger.info("Starting CreateMonthlyBudgetJob for space #{space_id} and date #{date}")
      operation = Budgets::Operations::CreateMonthlyBudget.new.call(space_id:, date:)

      if operation.success?
        Rails.logger.info("CreateMonthlyBudgetJob for space #{space_id} and date #{date} completed successfully")
      else
        Rails.logger.error("CreateMonthlyBudgetJob for space #{space_id} and date #{date} failed: #{operation.failure}")
        raise StandardError, operation.failure
      end
    end
  end
end
