# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Transactions
  module Operations
    module Transfers
      class UpdateAllInSeriesTransfers < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer).filled
          end

          rule(:transfer) do
            key.failure("must be a transfer") unless value.is_a?(Transactions::Transfer)
            key.failure("must be a changed transfer") unless value.changed?
          end
        end

        include Dry::Operation::Extensions::ActiveRecord

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) if contract.failure?

          Success(params)
        end

        def call(params)
          transaction do
            params                      = step validate(params:)
            transfer                    = step find_transfer(params:)
            schedule_changed            = step determine_schedule_change(transfer:)
            unless schedule_changed
              other_series_transfers    = step find_other_series_transfers(transfer:)
              _                         = step update_all_in_series(transfer:, other_series_transfers:)
              return transfer
            end

            parent_transfer             = step find_parent_transfer(transfer:)
            if transfer.id != parent_transfer.id
              parent_transfer           = step transfer_attributes(parent_transfer:, transfer:)
              _                         = step save_transfer(transfer:)
            else
              parent_transfer           = transfer
            end
            parent_transfer             = step update_this_and_future_transfers(parent_transfer:)

            parent_transfer
          end
        end

        private

        def find_transfer(params:)
          Success(params[:transfer])
        end

        def determine_schedule_change(transfer:)
          schedule_changed = transfer.schedule_type_changed? ||
                             transfer.repeat_interval_changed? ||
                             transfer.date_changed?

          Success(schedule_changed)
        end

        def find_parent_transfer(transfer:)
          Success(transfer.parent)
        end

        def find_other_series_transfers(transfer:)
          Success(transfer.series_transfers.where.not(id: transfer.id))
        end

        def update_all_in_series(transfer:, other_series_transfers:)
          other_series_transfers.find_each do |other_transfer|
            # Determine appropriate balance_state based on transfer date
            balance_state = other_transfer.date <= Time.zone.today ? "calculated" : "pending"

            other_transfer.assign_attributes(
              amount: transfer.amount,
              transaction_cost: transfer.transaction_cost,
              from_account_id: transfer.from_account_id,
              to_account_id: transfer.to_account_id,
              description: transfer.description,
              balance_state: balance_state
              # Note: We intentionally exclude schedule-related fields since we validated they haven't changed
            )

            account_changed = other_transfer.from_account_id_changed? || other_transfer.to_account_id_changed?
            if balance_state == "calculated" && account_changed
              UpdateCalculateBalances.new.call(transfer: other_transfer)
            end

            other_transfer.save!

            # Update the associated fee transaction
            update_transfer_fee_transaction(other_transfer)
          end

          Success(other_series_transfers)
        end

        def update_transfer_fee_transaction(transfer)
          fee_transaction = Transactions::Transaction.find_by(transfer_id: transfer.id)

          # If transfer cost is now zero, delete the fee transaction
          if transfer.transaction_cost.zero?
            return unless fee_transaction

            Transactions::Operations::DeleteThisTransaction.new.call(transaction: fee_transaction)
            return
          end

          # If fee transaction exists, update it
          if fee_transaction
            fee_transaction.assign_attributes(
              amount: transfer.transaction_cost,
              date: transfer.date,
              description: "Transfer fee for: #{transfer.description || 'Transfer'}"
            )
            Transactions::Operations::Accounts::UpdateCalculateBalance.new.call(transaction: fee_transaction)
            fee_transaction.save!
          else
            # Create new fee transaction if it doesn't exist
            CreateTransferFeeTransaction.new.call(
              transfer_id: transfer.id,
              user_id: transfer.user_id,
              space_id: transfer.space_id,
              transaction_cost: transfer.transaction_cost,
              transaction_cost_currency: transfer.transaction_cost_currency,
              date: transfer.date,
              description: transfer.description,
              balance_state: transfer.balance_state
            )
          end
        rescue StandardError => e
          # Log error but don't fail the entire operation
          Rails.logger.error "Failed to update fee transaction for transfer #{transfer.id}: #{e.message}"
        end

        def transfer_attributes(parent_transfer:, transfer:)
          Transactions::Operations::TransferAttributes.new.call(from_record: transfer, to_record: parent_transfer)
        end

        def save_transfer(transfer:)
          transfer.save!
          Success(transfer)
        end

        def update_this_and_future_transfers(parent_transfer:)
          Transactions::Operations::Transfers::UpdateThisAndFutureTransfers
            .new
            .call(transfer: parent_transfer, all_in_series: true)
        end
      end
    end
  end
end
