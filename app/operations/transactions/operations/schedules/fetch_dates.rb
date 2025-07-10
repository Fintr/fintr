# frozen_string_literal: true

module Transactions
  module Operations
    module Schedules
      class FetchDates < Dry::Operation
        class Contract < Dry::Validation::Contract
          ACCEPTED_RECORDS = [
            Transactions::Transaction,
            Transactions::Transfer
          ]

          params do
            required(:record)
            required(:date_start).value(:date)
            required(:date_end).value(:date)
          end

          rule(:record) do
            key.failure("must have a schedule") unless value.respond_to?(:schedule)
            key.failure("must be an instance of #{ACCEPTED_RECORDS.map(&:name).join(", ")}") unless ACCEPTED_RECORDS.include?(value.class.base_class)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params      = step validate(params:)
          schedule    = step fetch_schedule(params:)
          dates       = step fetch_dates(params:, schedule:)

          dates
        end

        private

        def fetch_schedule(params:)
          Success(IceCube::Schedule.from_hash(params[:record].schedule))
        end

        def fetch_dates(params:, schedule:)
          # NOTE: change timezone to current timezone becase schedule makes use of the server's timezone.
          # DANGER: having the schedule in the server's timezone might cause issues when the server is changed.
          start_date = params[:date_start].in_time_zone("Asia/Manila").beginning_of_day
          end_date = params[:date_end].in_time_zone("Asia/Manila").end_of_day

          dates = schedule.occurrences_between(start_date - 1.minute, end_date)

          Success(dates)
        rescue StandardError => e
          Failure(error: e)
        end
      end
    end
  end
end
