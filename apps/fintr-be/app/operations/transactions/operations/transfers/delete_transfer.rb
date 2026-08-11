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
          broadcast_rows = nil
          space_id = nil

          transfer = transaction do
            params         = step validate(params:)
            transfer       = step find_transfer(params:)
            space_id       = transfer.space_id
            broadcast_rows = step snapshot_for_broadcast(params:, transfer:)
            _              = step determine_action(params:, transfer:)
            _              = step update_monthly_summary(transfer:)
            transfer
          end

          step broadcast_deleted(
            space_id:,
            transactions: broadcast_rows,
            result: transfer,
            params:,
          )
        end

        private

        def find_transfer(params:)
          Success(Transactions::Transfer.find_by!(id: params[:id], space_id: params[:space_id]))
        rescue ActiveRecord::RecordNotFound
          Failure(id: "Transfer not found")
        end

        def snapshot_for_broadcast(params:, transfer:)
          transfers =
            case params[:delete_scope]
            when "this_and_future"
              transfer.series_transfers.where("date >= ?", transfer.date)
            when "all_in_series"
              transfer.series_transfers
            else
              Transactions::Transfer.where(id: transfer.id)
            end

          records = transfers.to_a
          fees = records.flat_map { |row| row.fee_transactions.to_a }
          payloads = Transactions::Broadcasts::TransactionChange.serialize_index_rows(
            transactions: records + fees,
          )
          Success(payloads)
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

        def broadcast_deleted(space_id:, transactions:, result:, params:)
          actor = Auth::User.find_by(id: params[:user_id]) || result&.user
          Transactions::Broadcasts::TransactionChange.deleted(
            space_id:,
            transactions:,
            actor:,
          )
          Success(result)
        end
      end
    end
  end
end
