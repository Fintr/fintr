# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Queries
    class CurrentMonthSummary < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
        end
      end

      def validate(params)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def call
        _ = step validate(params)
        space = step find_space
        summary = step find_or_create_current_summary(space:)
        summary
      end

      private

      def find_space
        space = Spaces::Space.find_by(code: params[:space_code])
        return Failure(space_code: "Space not found") if space.blank?

        Success(space)
      end

      def find_or_create_current_summary(space:)
        current_date = Date.current
        summary = MonthlyFinancialSummary.find_or_create_for_space_and_month(
          space:,
          year: current_date.year,
          month: current_date.month
        )
        Success(summary)
      rescue ActiveRecord::ActiveRecordError => e
        Failure(summary: "Failed to get current month summary", error: e.message)
      end
    end
  end
end
