# frozen_string_literal: true

module Transactions
  module Transfers
    class DuplicateTransferJob < ApplicationJob
      queue_as :default

      def perform(transfer_id)
        date = Utils::Dates.current_date_in_manila
        Transactions::Operations::Transfers::CreateRepeatTransfers
          .new
          .call(
            params: {
              transfer_id:,
              date_start: date + 1.month,
              date_end: date + 1.month,
            }
          )
      end
    end
  end
end
