# frozen_string_literal: true

module Transactions
  module Transfers
    class DuplicateTransferJob < ApplicationJob
      queue_as :default

      def perform(transfer_id)
        date = Time.zone.today.in_time_zone("Asia/Manila")
        Transactions::Operations::Transfers::CreateRepeatTransfers
          .new
          .call(
            transfer_id:,
            date_start: date + 1.month,
            date_end: date + 1.month
          )
      end
    end
  end
end
