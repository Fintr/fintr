# frozen_string_literal: true

module Transactions
  class CheckDuplicateTodayJob < ApplicationJob
    queue_as :default

    def perform
      Rails.logger.info("Starting DuplicateTransactionDailyJob")

      query = Transactions::Transaction.where.not(schedule: {})

      Rails.logger.info("Found #{query.count} transactions with schedule")

      date = Time.zone.now.in_time_zone("Asia/Manila")

      query.find_each(batch_size: 100) do |transaction|
        schedule = IceCube::Schedule.from_hash(transaction.schedule)
        occurs = schedule.occurring_between?(
          date.at_beginning_of_day,
          date.at_end_of_day
        )
        next unless occurs

        DuplicateJob.perform_later(transaction.id)
      end
    end
  end
end
