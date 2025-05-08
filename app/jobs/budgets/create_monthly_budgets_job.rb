# frozen_string_literal: true

module Budgets
  class CreateMonthlyBudgetsJob < ApplicationJob
    queue_as :default

    def perform(space_id:, date:)
      Rails.logger.info("Starting CreateMonthlyBudgetJob for space #{space_id} and date #{date}")
      Budgets::Operations::CreateMonthlyBudget.new.call(space_id:, date:)
    end
  end
end
