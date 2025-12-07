# frozen_string_literal: true

module Transactions
  class CheckDuplicateTodayJob < ApplicationJob
    queue_as :default

    def perform(start_date_string = nil)
      Rails.logger.info("Starting DuplicateTransactionDailyJob")

      query = Transactions::Transaction.where.not(schedule: {})

      Rails.logger.info("Found #{query.count} transactions with schedule")

      end_date = Utils::Dates.current_time_in_manila
      start_date = if start_date_string.present?
                     Date.parse(start_date_string).in_time_zone("Asia/Manila")
                   else
                     end_date
                   end

      Rails.logger.info("Processing dates from #{start_date.to_date} to #{end_date.to_date}")

      # Iterate through each date from start_date to end_date
      current_date = start_date.beginning_of_day
      while current_date <= end_date.end_of_day
        date_to_check = current_date

        query.find_each(batch_size: 100) do |transaction|
          schedule = IceCube::Schedule.from_hash(transaction.schedule)
          occurs = schedule.occurring_between?(
            date_to_check.at_beginning_of_day,
            date_to_check.at_end_of_day
          )
          next unless occurs

          Rails.logger.info(
            "Schedule occurs for transaction #{transaction.id} on #{date_to_check.to_date}, enqueueing DuplicateJob"
          )
          Transactions::DuplicateJob.perform_later(
            transaction.id,
            date_to_check.to_date.to_s
          )
        end

        current_date += 1.day
      end
    end
  end
end
