# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Operations
    class UpdateSummary < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:transaction_date).value(:date)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params = step validate(params:)
        summary = step find_or_create_summary(params:)
        step recalculate_summary(summary:)
      end

      private

      def find_or_create_summary(params:)
        space = Spaces::Space.find(params[:space_id])
        year = params[:transaction_date].year
        month = params[:transaction_date].month

        summary = MonthlyFinancialSummary.find_or_create_for_space_and_month(
          space:,
          year:,
          month:
        )

        Success(summary)
      rescue ActiveRecord::RecordNotFound => e
        Failure(space_id: "Space not found", error: e.message)
      end

      def recalculate_summary(summary:)
        summary.recalculate!
        Success(summary)
      rescue ActiveRecord::ActiveRecordError => e
        Failure(summary: "Failed to recalculate", error: e.message)
      end
    end
  end
end
