# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class UpdateTransfer < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).filled
            required(:user_id).value(:string)
            required(:space_id).value(:string)

            # Transfer details
            required(:amount).value(:decimal, gt?: 0)
            required(:transaction_cost).value(:decimal, gteq?: 0)
            required(:date).value(:date)
            required(:from_account_name).value(:string)
            required(:to_account_name).value(:string)
            optional(:description).value(:string)

            # Schedule type and related fields
            required(:schedule_type).value(:string)
            optional(:repeat_interval).maybe(:string)
            optional(:repeat_count).value(:integer)
            optional(:update_scope).value(:string)
            optional(:file)
          end

          # Validate that schedule_type is valid
          rule(:schedule_type) do
            valid_types = ["one_time", "repeat"]
            key.failure("must be one of: #{valid_types.join(", ")}") unless valid_types.include?(value)
          end

          # Validate repeat fields are present when schedule_type is 'repeat'
          rule(:repeat_interval, :schedule_type) do
            key(:repeat_interval).failure("must be provided for recurring transfers") if values[:schedule_type] == "repeat" && values[:repeat_interval].blank?
          end

          rule(:repeat_interval) do
            valid_intervals = Transactions::Transaction.repeat_intervals.values
            key.failure("must be a valid interval") if value && !valid_intervals.include?(value)
          end

          rule(:update_scope) do
            if value.present?
              valid_scopes = ["this_only", "this_and_future", "all_in_series"]
              key.failure("must be one of: #{valid_scopes.join(", ")}") unless valid_scopes.include?(value)
            end
          end

          rule(:transaction_cost) do
            key.failure("must be positive") if value.negative?
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          transfer = ActiveRecord::Base.transaction do
            params              = step validate(params:)
            transfer            = step find_transfer(params:)
            from_account        = step find_account(params:, account_name: params[:from_account_name])
            to_account          = step find_account(params:, account_name: params[:to_account_name])
            params              = step transform_params(params:, from_account:, to_account:)
            changed_transfer    = step initialize_update_transfer(transfer:, params:)
            _                   = step adjust_balances(transfer: changed_transfer)
            changed_transfer    = step update_schedule(transfer: changed_transfer, params:)
            _                   = step update_transfer_fee_transaction(transfer: changed_transfer, params:)
            _                   = step update_repeat_transfers(transfer: changed_transfer, params:)
            saved_transfer      = step save_transfer(transfer: changed_transfer)
            saved_transfer
          end
          _ = step attach_file(transfer:, params:) # NOTE: ActiveStorage doesn't save the file if inside a transaction block.
          transfer.reload
        end

        private

        def find_transfer(params:)
          transfer = Transactions::Transfer.find_by!(id: params[:id], space_id: params[:space_id])
          Success(transfer)
        rescue ActiveRecord::RecordNotFound
          Failure(id: "transfer not found")
        end

        def find_account(params:, account_name:)
          account = Transactions::Account.kept.find_by!(name: account_name, space_id: params[:space_id])
          Success(account)
        rescue ActiveRecord::RecordNotFound
          Failure(account_name: "'#{account_name}' not found")
        end

        def transform_params(params:, from_account:, to_account:)
          params = params.dup
          params[:from_account_id] = from_account.id
          params[:to_account_id] = to_account.id
          params[:amount_currency] = "PHP"
          params[:transaction_cost_currency] = "PHP"
          params[:repeat_count] ||= 1 if params[:schedule_type] == "repeat"
          params.delete(:from_account_name)
          params.delete(:to_account_name)
          Success(params)
        end

        def initialize_update_transfer(transfer:, params:)
          transfer.assign_attributes(**params.except(:id, :update_scope, :file))
          Success(transfer)
        end

        def adjust_balances(transfer:)
          return Success(transfer) unless transfer.changed? && transfer.balance_state == "calculated"

          UpdateCalculateBalances.new.call(transfer:)
        end

        def update_schedule(transfer:, params:)
          # Always create schedule for "this_and_future" updates to ensure proper job execution
          force_schedule_creation = params[:update_scope] == "this_and_future"

          return Success(transfer) unless force_schedule_creation || params[:schedule_type] == "repeat"

          schedule = Utils::Recurrence.schedule(
            date: params[:date],
            repeat_interval: params[:repeat_interval]
          )
          transfer.assign_attributes(schedule:)
          Success(transfer)
        rescue StandardError => e
          Failure(error: e)
        end

        def update_transfer_fee_transaction(transfer:, params:)
          # Find existing fee transaction
          fee_transaction = Transactions::Transaction.find_by(transfer_id: transfer.id)

          # If transfer cost is now zero, delete the fee transaction
          if transfer.transaction_cost.zero?
            return Success() unless fee_transaction

            Transactions::Operations::DeleteThisTransaction.new.call(transaction: fee_transaction)
            return Success()
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
              balance_state: transfer.balance_state,
              **params
            )
          end

          Success()
        rescue StandardError => e
          Failure(
            fee_transaction: "failed to update transfer fee transaction",
            error: e
          )
        end

        def update_repeat_transfers(transfer:, params:)
          return Success() unless params[:update_scope] && transfer.changed?

          case params[:update_scope]
          when "this_and_future", "all_in_series"
            UpdateRepeatTransfers.new.call(transfer:, update_scope: params[:update_scope])
          else
            Success()
          end
        end

        def save_transfer(transfer:)
          transfer.save!
          Success(transfer)
        rescue StandardError => e
          Failure(**transfer.errors.to_hash, error: e)
        end

        def attach_file(transfer:, params:)
          transfer.files.destroy_all
          return Success(transfer) if params[:file].blank?

          transfer.files.attach(params[:file])
          Success(transfer)
        end
      end
    end
  end
end
