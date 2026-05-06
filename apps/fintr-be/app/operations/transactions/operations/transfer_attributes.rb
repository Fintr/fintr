# frozen_string_literal: true

module Transactions
  module Operations
    class TransferAttributes < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:from_record).filled
          required(:to_record).filled
        end

        rule(:from_record) do
          key.failure("must be a record") unless value.is_a?(ActiveRecord::Base)
          key.failure("must be a changed record") unless value.changed?
        end

        rule(:to_record) do
          key.failure("must be a record") unless value.is_a?(ActiveRecord::Base)
        end

        rule(:from_record, :to_record) do
          key.failure("must be different") if values[:from_record].id == values[:to_record].id
          key.failure("must be from the same space") if values[:from_record].space_id != values[:to_record].space_id
          key.failure("must be of the same type") if values[:from_record].class != values[:to_record].class
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      include FailureHandler

      def call(params)
        params    = step validate(params:)
        to_record = step transfer_attributes(params:)
        to_record = step transfer_date(to_record:, params:)
        to_record = step update_schedule(to_record:, params:)
        to_record
      end

      private

      def transfer_attributes(params:)
        from_record = params[:from_record]
        to_record = params[:to_record]

        from_record.attributes.except("id", "space_id", "date", "created_at", "updated_at").each do |key, value|
          to_record.assign_attributes(key => value)
        end

        Success(to_record)
      end

      def transfer_date(to_record:, params:)
        from_record = params[:from_record]
        return Success(to_record) unless from_record.date_changed?

        # Calculate the difference in days between the old and new date
        # Use timezone-aware calculation to avoid timezone-related day calculation issues
        day_difference = Utils::Dates.days_difference_normalized(
          from_date: from_record.date_was,
          to_date: from_record.date
        )

        # Apply the same day difference to the target record
        to_record.date = to_record.date + day_difference.days

        Success(to_record)
      end

      def update_schedule(to_record:, params:)
        if to_record.schedule_type == "one_time"
          to_record.assign_attributes(schedule: {})
          return Success(to_record)
        end

        repeat_interval = to_record.schedule_type == "repeat" ? params[:from_record].repeat_interval : :installment
        schedule = Utils::Recurrence.schedule(
          date: to_record.date,
          repeat_interval:,
          installment_period: to_record.schedule_type == "installment" ? to_record.installment_period : nil
        )
        to_record.assign_attributes(schedule:)
        Success(to_record)
      end
    end
  end
end
