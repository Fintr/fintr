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

        include FailureHandler

        def call(params:)
          params            = step validate(params:)
          transfer          = step find_transfer(params:)
          return Success(transfer) unless transfer.repeat?

          params            = step add_default_values(params:)
          dates             = step fetch_dates(params:, transfer:)
          last_transfer     = step fetch_last_transfer(params:, transfer:)
          transfer_data     = step bulk_duplicate_transfers(params:, parent_transfer: transfer, last_transfer:, dates:)
          _                 = step create_bulk_fee_transactions(
                                    parent_transfer: transfer,
                                    dates:,
                                    balance_state: params[:balance_state]
                                  )
          _                 = step update_account_balances(
                                    parent_transfer: transfer,
                                    transfer_records: transfer_data[:transfer_records],
                                    dates:,
                                    balance_state: params[:balance_state]
                                  )
        end

        private

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
          existing_dates = parent_transfer.children.pluck(:date).map(&:to_date)
          dates = dates.reject { |date| existing_dates.include?(date) }

          # Prepare transfer records
          transfer_records = dates.map.with_index do |date, index|
            new_record = parent_transfer.amoeba_dup
            new_record.schedule = {}

            new_record.assign_attributes(
              parent_id:,
              date:,
              balance_state: params[:balance_state], # NOTE: Tells the app whether pending or calculated. We assume that transactions in the past were already reflected in current balances.
            )
            new_record.repeat_count = last_transfer.repeat_count + 1 + index if parent_transfer.repeat?
            new_record
          end

          # Bulk import transfers first
          Transactions::Transfer.bulk_import(
            transfer_records,
            validate: true,
            validate_uniqueness: true
          )

          Success({ transfer_records: transfer_records, dates: dates })
        end

        def create_bulk_fee_transactions(parent_transfer:, dates:, balance_state:)
          return Success() if parent_transfer.transaction_cost.zero?

          # Create fee transactions in bulk
          CreateBulkTransferFeeTransactions.new.call(
            parent_transfer_id: parent_transfer.id,
            dates: dates,
            balance_state: balance_state
          )
        end

        def update_account_balances(parent_transfer:, transfer_records:, dates:, balance_state:)
          return Success() unless balance_state == "calculated"

          # Calculate balance changes
          to_account_balance = parent_transfer.from_account.balance
          from_account_balance = parent_transfer.to_account.balance

          # Account for transfer amounts
          transfer_records.each do |transfer_record|
            from_account_balance -= transfer_record.value
            to_account_balance += transfer_record.value
          end

          # Update account balances
          to_account = parent_transfer.from_account
          to_account.assign_attributes(balance: to_account_balance)
          to_account.save!

          from_account = parent_transfer.to_account
          from_account.assign_attributes(balance: from_account_balance)
          from_account.save!

          Success()
        end
      end
    end
  end
end
