# frozen_string_literal: true

module Budgets
  class CreateSpaceMonthlyBudgetsJob < ApplicationJob
    queue_as :default

    def perform
      Rails.logger.info("Starting CreateMonthlyBudgetJob")

      query = Spaces::Space.all

      query.find_each(batch_size: 100) do |space|
        Budgets::CreateMonthlyBudgetJob.perform_later(space_id: space.id, date: Date.current)
      end
    end
  end
end
