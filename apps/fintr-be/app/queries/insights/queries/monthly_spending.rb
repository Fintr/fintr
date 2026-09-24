# frozen_string_literal: true

module Insights
  module Queries
    class MonthlySpending < BaseQuery
      Row = Struct.new(
        :month_year,
        :total_income,
        :total_expense,
        :net_amount,
        keyword_init: true
      )

      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:date_from).value(:date)
          optional(:date_to).maybe(:date)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call
        params = step validate(params: @params)
        space = step load_space(params:)
        step aggregate_by_month(
          space:,
          params:
        )
      end

      private

      def load_space(params:)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(space_id: "Not found") if space.blank?

        Success(space)
      end

      def aggregate_by_month(space:, params:)
        earliest_transaction_date = MonthlyFinancialSummaries::Queries::EarliestTransactionDateForSpace.call(
          space:
        )
        return Success([]) if earliest_transaction_date.blank?

        # Trends end at the selected period's month (not always "today").
        end_date = (params[:date_to] || Time.zone.today).to_date.end_of_month
        start_date = [
          params[:date_from].beginning_of_month.to_date,
          earliest_transaction_date.beginning_of_month
        ].max
        return Success([]) if start_date > end_date

        rows = []
        month_start = start_date

        while month_start <= end_date
          totals = MonthlyFinancialSummaries::Queries::TotalsForMonth.call(
            space:,
            month_start:,
            persist_stale: false
          )

          unless MonthlyFinancialSummary.totals_empty?(totals)
            income = totals[:total_income]
            expense = totals[:total_expenses]

            rows << Row.new(
              month_year: month_start.in_time_zone,
              total_income: income.round(2),
              total_expense: expense.round(2),
              net_amount: (income - expense).round(2)
            )
          end

          month_start += 1.month
        end

        Success(rows)
      rescue StandardError => e
        Failure(aggregate_by_month: "Failed to aggregate monthly spending", error: e.message)
      end
    end
  end
end
