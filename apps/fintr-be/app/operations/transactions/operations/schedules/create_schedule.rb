# frozen_string_literal: true

module Transactions
  module Operations
    module Schedules
      class CreateSchedule < Dry::Operation
        class Contract < Dry::Validation::Contract
          SCHEDULE_TYPES = Transactions::Transaction.schedule_types.keys.freeze

          params do
            required(:schedule_type).value(:string)
            required(:date).value(:date)
            optional(:repeat_interval).value(:string)
            optional(:installment_period).value(:integer)
          end

          rule(:schedule_type) do
            key.failure("must be one of #{SCHEDULE_TYPES.join(", ")}") unless value.in?(SCHEDULE_TYPES)
          end

          rule(:repeat_interval) do
            key.failure("not supplied for repeat schedule") if value.blank? && values[:schedule_type] == "repeat"
          end

          rule(:installment_period) do
            key.failure("not supplied for installment schedule") if value.blank? && values[:schedule_type] == "installment"
            key.failure("must be a positive integer") if value.present? && value <= 0
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          _        = step validate(params:)
          schedule = step create_schedule(params:)
          schedule
        end

        def create_schedule(params:)
          schedule_type = params[:schedule_type]
          return Success() if schedule_type == "one_time"

          repeat_interval = schedule_type == "repeat" ? params[:repeat_interval] : :installment
          schedule = Utils::Recurrence.schedule(
            repeat_interval:,
            date: params[:date],
            installment_period: params[:installment_period]
          )

          Success(schedule.to_hash)
        rescue StandardError => e
          Failure(error: e)
        end
      end
    end
  end
end
