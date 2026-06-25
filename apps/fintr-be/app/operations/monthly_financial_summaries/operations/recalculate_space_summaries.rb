# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Operations
    # Rebuilds FX-based monthly buckets for a space in the space's current currency.
    # Used after a space currency change (and for manual backfills).
    class RecalculateSpaceSummaries < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        space = step find_space(params:)
        month_keys = step month_keys_for_recalculation(space:)
        step recalculate_summaries(
          space:,
          month_keys:
        )
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

      def month_keys_for_recalculation(space:)
        transaction_keys = space.transactions
          .calculated
          .joins(:category)
          .where.not(transactions_categories: { name: "Initial Balance" })
          .distinct
          .pluck(
            Arel.sql("EXTRACT(YEAR FROM transactions.date)::integer"),
            Arel.sql("EXTRACT(MONTH FROM transactions.date)::integer")
          )

        summary_keys = space.monthly_financial_summaries.pluck(:year, :month)
        Success((transaction_keys + summary_keys).uniq)
      end

      def recalculate_summaries(space:, month_keys:)
        target_currency = space.currency.presence || "PHP"
        sorted_month_keys = month_keys.sort_by { |year, month| [year, month] }

        sorted_month_keys.each do |year, month|
          MonthlyFinancialSummary.recalculate_for_space_and_month!(
            space:,
            year:,
            month:
          )
        end

        Success(
          currency: target_currency,
          months_recalculated: sorted_month_keys.size
        )
      end
    end
  end
end
