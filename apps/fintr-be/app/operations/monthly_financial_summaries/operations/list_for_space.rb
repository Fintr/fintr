# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Operations
    # Returns raw monthly financial summary buckets for a space.
    # Ensures months from the earliest transaction through the end of the range
    # are hydrated (FX-based) so offline clients can combine ~N month rows
    # instead of re-aggregating transactions.
    class ListForSpace < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          optional(:start_date).maybe(:string)
          optional(:end_date).maybe(:string)
          optional(:persist_stale).maybe(:bool)
        end
      end

      def call(params)
        params = step validate(params:)
        space = step find_space(params:)
        range = step resolve_range(space:, params:)
        step hydrate_months(
          space:,
          range:,
          persist_stale: params.fetch(:persist_stale, true)
        )
        step load_summaries(space:, range:)
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def find_space(params:)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(space_id: "not found") if space.blank?

        Success(space)
      end

      def resolve_range(space:, params:)
        earliest = MonthlyFinancialSummaries::Queries::EarliestTransactionDateForSpace.call(
          space:
        )

        end_date = parse_optional_date(params[:end_date]) || Date.current
        start_date =
          parse_optional_date(params[:start_date]) ||
          earliest&.beginning_of_month ||
          end_date.beginning_of_month

        return Failure(date: "start_date must be before or equal to end_date") if start_date > end_date

        Success(
          start_date: start_date.beginning_of_month,
          end_date: end_date.end_of_month
        )
      rescue Date::Error => e
        Failure(date: "Invalid date format", error: e.message)
      end

      def hydrate_months(space:, range:, persist_stale:)
        current = range[:start_date].beginning_of_month
        last = range[:end_date].beginning_of_month

        while current <= last
          MonthlyFinancialSummaries::Queries::TotalsForMonth.call(
            space:,
            month_start: current,
            persist_stale:
          )
          current = current.next_month
        end

        Success(true)
      end

      def load_summaries(space:, range:)
        summaries = space.monthly_financial_summaries.in_date_range(
          start_date: range[:start_date],
          end_date: range[:end_date]
        )

        Success(summaries.to_a)
      end

      def parse_optional_date(value)
        return nil if value.blank?

        Date.parse(value)
      end
    end
  end
end
