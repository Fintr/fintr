# frozen_string_literal: true

module Transactions
  module Transfers
    class DuplicateTransferJob < ApplicationJob
      queue_as :default

      def perform(transfer_id)
        Transactions::Operations::Transfers::CreateRepeatTransfers
          .new
          .call(
            transfer_id:,
            date_start: Time.zone.today + 1.month,
            date_end: Time.zone.today + 1.month
          )
      end
    end
  end
end
