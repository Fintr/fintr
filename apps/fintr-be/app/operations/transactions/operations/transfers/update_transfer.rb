# frozen_string_literal: true

require "dry/operation/extensions/active_record"
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
            optional(:remove_file).maybe(:bool)
            optional(:exchange_rate).value(:decimal, gt?: 0)
            optional(:exchange_rate_source).value(:string, included_in?: %w[auto manual recent])
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
        include Dry::Operation::Extensions::ActiveRecord

        CONVERSION_PARAMS = %i[original_currency exchange_rate exchange_rate_source].freeze

        def call(params)
          transfer = transaction do
            params              = step validate(params:)
            transfer            = step find_transfer(params:)
            from_account        = step find_account(
                                    params:,
                                    account_name: params[:from_account_name].to_s,
                                    error_key: :from_account_name
                                  )
            to_account          = step find_account(
                                    params:,
                                    account_name: params[:to_account_name].to_s,
                                    error_key: :to_account_name
                                  )
            prepared            = step prepare_conversion_data(
                                    params:,
                                    from_account:,
                                    to_account:
                                  )
            params = prepared[:params]
            conversion_data = prepared[:conversion_data]
            params              = step transform_params(params:, from_account:, to_account:)
            changed_transfer    = step initialize_update_transfer(transfer:, params:)
            _                   = step adjust_balances(transfer: changed_transfer)
            changed_transfer    = step update_schedule(transfer: changed_transfer, params:)
            new_transfer        = step update_repeat_transfers(transfer: changed_transfer, params:)
            _                   = step update_transfer_fee_transaction(transfer: new_transfer, params:)
            # Account balances first; then attach conversion so model validation can pass on save.
            _                   = step sync_currency_conversion_for_save(
                                    transfer: new_transfer,
                                    conversion_data:,
                                  )
            saved_transfer      = step save_transfer(transfer: new_transfer)
            _                   = step persist_currency_conversion(
                                    transfer: saved_transfer,
                                    conversion_data:,
                                  )
            saved_transfer
          end
          _ = step attach_file(transfer:, params:) # NOTE: ActiveStorage doesn't save the file if inside a transaction block.
          _ = step update_monthly_summary(transfer:)
          transfer = transfer.reload
          step broadcast_updated(transfer:, params:)
        end

        private

        def broadcast_updated(transfer:, params:)
          actor = Auth::User.find_by(id: params[:user_id]) || transfer.user
          records = [transfer] + transfer.fee_transactions.to_a
          if records.size > 1
            Transactions::Broadcasts::TransactionChange.updated_many(
              transactions: records,
              actor:,
            )
          else
            Transactions::Broadcasts::TransactionChange.updated(
              transaction: transfer,
              actor:,
            )
          end
          Success(transfer)
        end

        def find_transfer(params:)
          transfer = Transactions::Transfer
            .includes(:from_account, :to_account)
            .find_by!(id: params[:id], space_id: params[:space_id])
          Success(transfer)
        rescue ActiveRecord::RecordNotFound
          Failure(id: "transfer not found")
        end

        def find_account(params:, account_name:, error_key: :account_name)
          account = Transactions::Account.kept.find_by!(name: account_name, space_id: params[:space_id])
          Success(account)
        rescue ActiveRecord::RecordNotFound
          Failure(error_key => "'#{account_name}' not found")
        end

        def prepare_conversion_data(params:, from_account:, to_account:)
          ::Transactions::Operations::Transfers::PrepareCurrencyConversion.new.call(
            params:,
            from_account:,
            to_account:
          )
        end

        def transform_params(params:, from_account:, to_account:)
          params = params.dup
          params[:from_account_id] = from_account.id
          params[:to_account_id] = to_account.id
          amount_currency =
            params[:amount_currency].presence ||
            from_account.balance_currency
          params[:amount_currency] = amount_currency
          params[:transaction_cost_currency] = amount_currency
          params[:repeat_count] ||= 1 if params[:schedule_type] == "repeat"
          params.delete(:from_account_name)
          params.delete(:to_account_name)
          params.delete(:exchange_rate)
          params.delete(:exchange_rate_source)
          Success(params)
        end

        # Attach or clear the association before save so +currencies_match+ validation can pass.
        def sync_currency_conversion_for_save(transfer:, conversion_data:)
          unless conversion_data[:needs_conversion]
            transfer.currency_conversion&.destroy!
            transfer.association(:currency_conversion).reset
            return Success(transfer)
          end

          attrs = conversion_attributes(conversion_data:, space_id: transfer.space_id)
          if transfer.currency_conversion.present?
            transfer.currency_conversion.assign_attributes(attrs)
          else
            transfer.build_currency_conversion(**attrs)
          end
          Success(transfer)
        end

        def conversion_attributes(conversion_data:, space_id:)
          original_currency = conversion_data[:original_currency]
          converted_currency = conversion_data[:converted_currency]
          original_subunit =
            Money::Currency
              .new(original_currency)
              .subunit_to_unit
          converted_subunit =
            Money::Currency
              .new(converted_currency)
              .subunit_to_unit

          {
            space_id:,
            original_amount_cents: (
              BigDecimal(conversion_data[:original_amount].to_s) * original_subunit
            ).to_i,
            original_currency:,
            converted_amount_cents: (
              BigDecimal(conversion_data[:converted_amount].to_s) * converted_subunit
            ).to_i,
            converted_currency:,
            exchange_rate: conversion_data[:exchange_rate],
            source: conversion_data[:source],
            rate_timestamp: conversion_data[:rate_timestamp]
          }
        end

        # Overwrite conversion metadata after account balances and transfer save.
        def persist_currency_conversion(transfer:, conversion_data:)
          step ::Transactions::Operations::Transfers::PersistCurrencyConversion.new.call(
            transfer:,
            conversion_data:
          )
        end

        def initialize_update_transfer(transfer:, params:)
          assignable = params.except(:id, :update_scope, :file, :remove_file, *CONVERSION_PARAMS)
          transfer.assign_attributes(**assignable)
          Success(transfer)
        end

        def adjust_balances(transfer:)
          return Success(transfer) unless transfer.changed? && transfer.balance_state == "calculated"

          UpdateCalculateBalances.new.call(transfer:)
        end

        def update_schedule(transfer:, params:)
          # Always create schedule for "this_and_future" updates to ensure proper job execution
          force_schedule_creation = params[:update_scope] == "this_and_future"

          return Success(transfer) unless force_schedule_creation ||
                                          transfer.schedule_type_changed? ||
                                          transfer.repeat_interval_changed? ||
                                          transfer.date_changed?

          if transfer.schedule_type == "one_time"
            schedule = {}
          else
            schedule = Utils::Recurrence.schedule(
              date: transfer.date,
              repeat_interval: transfer.repeat_interval
            )
          end
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
              description: transfer.fee_transaction_description
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
          return Success(transfer) unless params[:update_scope] && transfer.changed?

          # - Future transfers: balance_state = "pending" (will be calculated by daily job)
          UpdateRepeatTransfers.new.call(
            transfer:,
            update_scope: params[:update_scope]
          )
        end

        def save_transfer(transfer:)
          transfer.save!
          Success(transfer)
        rescue StandardError => e
          Failure(**transfer.errors.to_hash, error: e)
        end

        def attach_file(transfer:, params:)
          if params[:remove_file]
            transfer.files.destroy_all if transfer.files.attached?
            return Success(transfer)
          end

          return Success(transfer) if params[:file].blank?

          transfer.files.destroy_all

          Utils::ActiveStorage.attach_file(transfer.files, params[:file], params[:space_id])
          Success(transfer)
        end

        def update_monthly_summary(transfer:)
          dates = [transfer.date.to_date]

          if transfer.saved_change_to_date?
            previous_date = transfer.saved_change_to_date.first
            if previous_date &&
               (previous_date.year != transfer.date.year ||
                previous_date.month != transfer.date.month)
              dates << previous_date.to_date
            end
          end

          dates.uniq.each do |date|
            MonthlyFinancialSummaries::Operations::UpdateSummary.new.call(
              space_id: transfer.space_id,
              transaction_date: date
            )
          end

          Success()
        end
      end
    end
  end
end
