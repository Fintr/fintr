# frozen_string_literal: true

module Transactions
  class CheckDuplicateTodayJob < ApplicationJob
    queue_as :default

    def perform
      Rails.logger.info("Starting DuplicateTransactionDailyJob")

      query = Transactions::Transaction.where.not(schedule: {})

      Rails.logger.info("Found #{query.count} transactions with schedule")

      query.find_each(batch_size: 100) do |transaction|
        schedule = IceCube::Schedule.from_hash(transaction.schedule)
        occurs = schedule.occurring_between?(
          Time.zone.today.in_time_zone("Asia/Manila").at_beginning_of_day,
          Time.zone.today.in_time_zone("Asia/Manila").at_end_of_day
        )
        next unless occurs

        DuplicateJob.perform_later(transaction.id)
      end
    end
  end
end
