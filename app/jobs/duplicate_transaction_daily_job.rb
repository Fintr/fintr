# frozen_string_literal: true

class DuplicateTransactionDailyJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info("Starting DuplicateTransactionDailyJob")

    query = Transactions::Transaction.where.not(schedule: {})

    Rails.logger.info("Found #{query.count} transactions with schedule")

    query.find_each(batch_size: 100) do |transaction|
      schedule = IceCube::Schedule.from_hash(transaction.schedule)
      occurs = schedule.occurring_between?(DateTime.current.at_beginning_of_day, DateTime.current.at_end_of_day)
      next unless occurs

      DuplicateTransactionJob.perform_later(transaction.id)
    end
  end
end
