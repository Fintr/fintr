# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Transactions
  module Operations
    module Transfers
      class DeleteTransfer < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).filled(:string)
            required(:space_id).filled(:string)
            optional(:delete_scope).value(:string)
          end

          rule(:delete_scope) do
            if value.present?
              valid_scopes = ["this_only", "this_and_future", "all_in_series"]
              key.failure("must be one of: #{valid_scopes.join(", ")}") unless valid_scopes.include?(value)
            end
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params.except(:transfer))
          return Failure(contract.errors.to_h) if contract.failure?

          Success(params)
        end

        include Dry::Operation::Extensions::ActiveRecord

        def call(params)
          transaction do
            params   = step validate(params:)
            transfer = step find_transfer(params:)
            _        = step determine_action(params:, transfer:)
            _        = step update_monthly_summary(transfer:)
            transfer
          end
        end

        private

        def find_transfer(params:)
          Success(Transactions::Transfer.find_by!(id: params[:id], space_id: params[:space_id]))
        rescue ActiveRecord::RecordNotFound
          Failure(id: "Transfer not found")
        end

        def determine_action(params:, transfer:)
          case params[:delete_scope]
          when "this_only"
            Transactions::Operations::Transfers::DeleteThisTransfer.new.call(transfer:)
          when "this_and_future"
            Transactions::Operations::Transfers::DeleteThisAndFutureTransfers.new.call(transfer:)
          when "all_in_series"
            Transactions::Operations::Transfers::DeleteAllInSeriesTransfers.new.call(transfer:)
          else
            Transactions::Operations::Transfers::DeleteThisTransfer.new.call(transfer:)
          end
        end

        def update_monthly_summary(transfer:)
          MonthlyFinancialSummaries::Operations::UpdateSummary.new.call(
            space_id: transfer.space_id,
            transaction_date: transfer.date.to_date
          )

          Success()
        end
      end
    end
  end
end
