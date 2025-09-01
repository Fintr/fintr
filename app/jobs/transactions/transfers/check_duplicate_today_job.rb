# frozen_string_literal: true

module Transactions
  module Transfers
    class CheckDuplicateTodayJob < ApplicationJob
      queue_as :default

      def perform
        Rails.logger.info("Starting Transfers::CheckDuplicateTodayJob")

        query = Transactions::Transfer.where.not(schedule: {})

        Rails.logger.info("Found #{query.count} transfers with schedule")

        query.find_each(batch_size: 100) do |transfer|
          schedule = IceCube::Schedule.from_hash(transfer.schedule)
          occurs = schedule.occurring_between?(
            Time.zone.today.in_time_zone("Asia/Manila").at_beginning_of_day,
            Time.zone.today.in_time_zone("Asia/Manila").at_end_of_day
          )
          next unless occurs

          DuplicateTransferJob.perform_later(transfer.id)
        end
      end
    end
  end
end
