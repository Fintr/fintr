# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class CreateRepeatTransfers < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:transfer_id).value(:string)
            required(:date_start).value(:date)
            required(:date_end).value(:date)
            optional(:balance_state).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params:)
          params            = step validate(params:)
          transfer          = step find_transfer(params:)
          return Success(transfer) unless transfer.repeat?

          params            = step add_default_values(params:)
          dates             = step fetch_dates(params:, transfer:)
          last_transfer     = step fetch_last_transfer(params:, transfer:)
          _                 = step bulk_duplicate_transfers(params:, parent_transfer: transfer, last_transfer:, dates:)
        end

        def find_transfer(params:)
          Success(Transactions::Transfer.find(params[:transfer_id]))
        rescue ActiveRecord::RecordNotFound => e
          Failure(transfer_id: "not found", error: e)
        end

        def add_default_values(params:)
          params[:balance_state] ||= "pending"
          Success(params)
        end

        def fetch_dates(params:, transfer:)
          Transactions::Operations::Schedules::FetchDates.new.call(params: {
            record: transfer,
            date_start: params[:date_start],
            date_end: params[:date_end]
          })
        end

        def fetch_last_transfer(params:, transfer:)
          params = { record: transfer, date_end: params[:date_end] }
          Queries::LastRecord.call(relation: Transactions::Transfer.all, params:)
        end


        def bulk_duplicate_transfers(params:, parent_transfer:, last_transfer:, dates:)
          parent_id = parent_transfer.parent_id || parent_transfer.id
          to_account_balance = parent_transfer.from_account.balance.amount
          from_account_balance = parent_transfer.to_account.balance.amount

          existing_dates = parent_transfer.children.pluck(:date).map(&:to_date)
          dates = dates.reject { |date| existing_dates.include?(date) }

          records = dates.map.with_index do |date, index|
            new_record = parent_transfer.amoeba_dup
            new_record.schedule = {}

            if params[:balance_state] == "calculated"
              from_account_balance -= new_record.value.amount
              to_account_balance += new_record.value.amount
            end

            new_record.assign_attributes(
              parent_id:,
              date:,
              balance_state: params[:balance_state], # NOTE: Tells the app whether pending or calculated. We assume that transactions in the past were already reflected in current balances.
            )
            new_record.repeat_count = last_transfer.repeat_count + 1 + index if parent_transfer.repeat?
            new_record
          end

          to_account = parent_transfer.from_account
          to_account.assign_attributes(balance: to_account_balance)
          to_account.save!

          from_account = parent_transfer.to_account
          from_account.assign_attributes(balance: from_account_balance)
          from_account.save!

          Transactions::Transfer.bulk_import(
            records,
            validate: true,
            validate_uniqueness: true
          )
          Success()
        end
      end
    end
  end
end
