# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class TransfersController < ApiController
        def create
          params = with_current_params(create_params)
          operation = ::Transactions::Operations::Transfers::CreateTransfer.new.call(params:)

          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          render_created(record: operation.value!)
        end

        private

        def create_params
          params.permit(
            :amount,
            :transaction_cost,
            :date,
            :description,
            :from_account_name,
            :to_account_name,
            :schedule_type,
            :repeat_interval,
            :repeat_count
          )
        end
      end
    end
  end
end
