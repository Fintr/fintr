# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Transactions
  module Operations
    module Transfers
      class CreateTransfer < Dry::Operation
        include Dry::Operation::Extensions::ActiveRecord

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

            # Exchange rate / conversion (optional)
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
          params   = step validate(params:)
          transfer = transaction do
            from_account    = step find_account(params:, account_name: params[:from_account_name])
            to_account      = step find_account(params:, account_name: params[:to_account_name])
            params, conversion_data = step handle_currency_conversion(
              params:,
              from_account:,
              to_account:
            )
            params          = step transform_params(params:, from_account:, to_account:)
            transfer        = step create_transfer(params:, conversion_data:)
            _               = step create_conversion_record(transfer:, conversion_data:)
            _               = step create_transfer_fee_transaction(transfer:, params:)
            _               = step calculate_balances(transfer:)
            transfer        = step create_schedule(transfer:, params:) if params[:schedule_type] != "one_time"
            _               = step create_past_transfers(transfer:) if transfer.repeat?
            _               = step create_future_transfers(transfer:) if transfer.repeat?
            transfer.reload
          end
          _ = step attach_file(transfer:, params:)
          _ = step sync_series_children_files(transfer:)
          _ = step update_monthly_summary(transfer:)
          _ = step generate_embedding_async(transfer:)
          transfer.reload
        end

        private

        def find_account(params:, account_name:)
          account = Transactions::Account.kept.find_by!(name: account_name, space_id: params[:space_id])
          Success(account)
        rescue ActiveRecord::RecordNotFound => e
          Failure(account_name: "'#{account_name}' not found", error: e, expected: true)
        end

        def handle_currency_conversion(params:, from_account:, to_account:)
          from_currency = from_account.balance_currency
          to_currency = to_account.balance_currency
          original_amount = params[:amount]

          if from_currency == to_currency
            # No conversion: pass minimal data so we never build or persist a currency_conversion.
            conversion_data = {
              needs_conversion: false,
              original_amount:,
              original_currency: from_currency,
              converted_amount: original_amount,
              converted_currency: from_currency,
              exchange_rate: 1.0,
              rate_timestamp: Time.current
            }
            return Success([params.merge(amount_currency: from_currency), conversion_data])
          end

          rate = params[:exchange_rate]
          unless rate
            rate_result = step ::ExchangeRates::Operations::FetchRate.new.call(
              from_currency:,
              to_currency:,
              space_id: params[:space_id],
              date: params[:date]
            )
            rate = rate_result[:rate]
            params = params.merge(exchange_rate_source: rate_result[:source])
          end

          converted_amount = (BigDecimal(original_amount.to_s) * rate).round(2)
          conversion_data = {
            needs_conversion: true,
            original_amount:,
            original_currency: from_currency,
            converted_amount:,
            converted_currency: to_currency,
            exchange_rate: rate,
            source: params[:exchange_rate_source] || "manual",
            rate_timestamp: Time.current
          }
          Success([
            params.merge(amount_currency: to_currency, amount: converted_amount),
            conversion_data
          ])
        end

        def create_conversion_record(transfer:, conversion_data:)
          step ::Transactions::Operations::Transfers::PersistCurrencyConversion.new.call(
            transfer:,
            conversion_data:
          )
          Success(nil)
        end

        def transform_params(params:, from_account:, to_account:)
          params = params.dup
          params[:from_account_id] = from_account.id
          params[:to_account_id] = to_account.id
          params[:repeat_count] = 1 if params[:schedule_type] == "repeat"
          params[:balance_state] = "pending"
          params[:amount_currency] = params[:amount_currency] || from_account.balance_currency
          params[:transaction_cost_currency] = params[:amount_currency]
          params.delete(:from_account_name)
          params.delete(:to_account_name)
          params.delete(:exchange_rate)
          params.delete(:exchange_rate_source)

          Success(params)
        end

        def create_transfer(params:, conversion_data:)
          transfer = Transactions::Transfer.new(params.except(:file))
          build_currency_conversion_on_transfer(transfer:, conversion_data:, space_id: params[:space_id])
          transfer.save!
          Success(transfer)
        rescue ActiveRecord::RecordInvalid => e
          Failure(transfer: transfer.errors.to_hash, error: e, expected: true)
        rescue StandardError => e
          error_hash = transfer.respond_to?(:errors) ? transfer.errors.to_hash : { error: e.message }
          Failure(transfer: error_hash, error: e, expected: false)
        end

        def build_currency_conversion_on_transfer(transfer:, conversion_data:, space_id:)
          return unless conversion_data[:needs_conversion]

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

          transfer.build_currency_conversion(
            space_id: space_id,
            original_amount_cents: (
              BigDecimal(conversion_data[:original_amount].to_s) * original_subunit
            ).to_i,
            original_currency: original_currency,
            converted_amount_cents: (
              BigDecimal(conversion_data[:converted_amount].to_s) * converted_subunit
            ).to_i,
            converted_currency: converted_currency,
            exchange_rate: conversion_data[:exchange_rate],
            source: conversion_data[:source],
            rate_timestamp: conversion_data[:rate_timestamp]
          )
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

          Utils::ActiveStorage.attach_file(transfer.files, params[:file], params[:space_id])
          Success(transfer)
        end

        def sync_series_children_files(transfer:)
          Utils::ActiveStorage.sync_template_files_to_children(source_record: transfer)
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
        rescue ActiveRecord::RecordInvalid => e
          Failure(error: e, expected: true)
        rescue StandardError => e
          Failure(error: e, expected: false)
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

        def update_monthly_summary(transfer:)
          MonthlyFinancialSummaries::Operations::UpdateSummary.new.call(
            space_id: transfer.space_id,
            transaction_date: transfer.date.to_date
          )

          Success()
        end

        def generate_embedding_async(transfer:)
          Ai::Embeddings::GenerateEmbeddingJob.perform_later(
            embeddable_id: transfer.id,
            embeddable_type: transfer.class.name,
            space_id: transfer.space_id
          )
          Success(transfer)
        end
      end
    end
  end
end
