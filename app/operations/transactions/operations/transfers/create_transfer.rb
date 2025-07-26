# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class CreateTransfer < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            # Current user and space
            required(:user_id).value(:string)
            required(:space_id).value(:string)

            # Transfer details
            required(:amount).value(:decimal, gt?: 0)
            required(:transaction_cost).value(:decimal, gteq?: 0)
            required(:date).value(:date)
            required(:from_account_name).value(:string)
            required(:to_account_name).value(:string)
            optional(:description).value(:string)
            optional(:file)

            # Schedule type and related fields
            required(:schedule_type).value(:string)
            optional(:repeat_interval).maybe(:string)
            optional(:repeat_count).value(:integer)
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

        def call(params:)
          transfer = ActiveRecord::Base.transaction do
            params          = step validate(params:)
            from_account    = step find_account(params:, account_name: params[:from_account_name])
            to_account      = step find_account(params:, account_name: params[:to_account_name])
            params          = step transform_params(params:, from_account:, to_account:)
            transfer        = step create_transfer(params:)
            # Always create fee transaction for the parent transfer
            _               = step create_transfer_fee_transaction(transfer:, params:)
            _               = step calculate_balances(transfer:)
            transfer        = step create_schedule(transfer:, params:) if params[:schedule_type] != "one_time"

            _               = step create_past_transfers(transfer:) if transfer.repeat?
            _               = step create_future_transfers(transfer:) if transfer.repeat?
            transfer.reload
          end
          _   = step attach_file(transfer:, params:)
          transfer.reload
        end

        private

        def find_account(params:, account_name:)
          account = Transactions::Account.kept.find_by!(name: account_name, space_id: params[:space_id])
          Success(account)
        rescue ActiveRecord::RecordNotFound => e
          Failure(account_name: "'#{account_name}' not found", error: e)
        end

        def transform_params(params:, from_account:, to_account:)
          params = params.dup
          params[:from_account_id] = from_account.id
          params[:to_account_id] = to_account.id
          params[:repeat_count] = 1 if params[:schedule_type] == "repeat"
          params[:balance_state] = "pending"
          params[:amount_currency] = "PHP"
          params[:transaction_cost_currency] = "PHP"
          params.delete(:from_account_name)
          params.delete(:to_account_name)

          Success(params)
        end

        def create_transfer(params:)
          transfer = Transactions::Transfer.new(params.except(:file))
          transfer.save!
          Success(transfer)
        rescue StandardError => e
          Failure(transfer: transfer.errors.to_hash, error: e)
        end

        def create_transfer_fee_transaction(transfer:, params:)
          return Success() unless transfer.transaction_cost.amount.positive?

          CreateTransferFeeTransaction.new.call(
            transfer_id: transfer.id,
            balance_state: "calculated",
            **params
          )
        end

        def attach_file(transfer:, params:)
          return Success(transfer) if params[:file].blank?

          transfer.file.attach(params[:file])
          Success(transfer)
        end

        def calculate_balances(transfer:)
          params = { transfer_id: transfer.id }
          CalculateBalances.new.call(params)
        end

        def create_schedule(transfer:, params:)
          return Success(transfer) unless params[:schedule_type] == "repeat"

          schedule = Utils::Recurrence.schedule(
            date: params[:date],
            repeat_interval: params[:repeat_interval]
          )
          transfer.assign_attributes(schedule:)
          transfer.save!
          Success(transfer)
        rescue StandardError => e
          Failure(error: e)
        end

        def create_past_transfers(transfer:)
          return Success() if transfer.one_time?
          return Success() if transfer.date >= Time.zone.today

          CreateRepeatTransfers.new.call(params: {
            transfer_id: transfer.id,
            balance_state: "calculated",
            date_start: (transfer.date + 1.day).to_datetime, # NOTE: somehow need .to_datetime to avoid errors
            date_end: Time.zone.today
          })
        end

        # Note: Creates repeat transactions until + 1.month
        def create_future_transfers(transfer:)
          return Success() if transfer.one_time?

          CreateRepeatTransfers.new.call(params: {
            transfer_id: transfer.id,
            balance_state: "pending",
            date_start: Time.zone.tomorrow,
            date_end: Time.zone.today + 1.month
          })
        end
      end
    end
  end
end
