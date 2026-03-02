# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Queries
    # Returns a single aggregate (total_income, total_expenses, net_savings) for a date range.
    # Uses up to 3 queries for speed:
    # - Partial first month (if range doesn't start on 1st): one transaction query.
    # - Full months in between: one cache query, then sum.
    # - Partial last month (if range doesn't end on last day): one transaction query.
    # Result is combined into one summary, not per-month hashes.
    class DateRangeSummary < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
          required(:start_date).filled(:string)
          required(:end_date).filled(:string)
        end
      end

      def validate(params)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def call
        _       = step validate(params)
        space   = step find_space
        range   = step parse_dates
        pieces  = step compute_range_pieces(range:)
        first   = nil
        last    = nil
        cache   = nil
        first   = step aggregate_transactions_for_range(space:, start_date: pieces[:first_start], end_date: pieces[:first_end]) if pieces[:first_start]
        last    = step aggregate_transactions_for_range(space:, start_date: pieces[:last_start], end_date: pieces[:last_end]) if pieces[:last_start]
        cache   = step aggregate_cached_summaries(space:, month_dates: pieces[:full_month_dates]) if pieces[:full_month_dates].present?
        combined = step combine_totals(first:, last:, cache:)
        numeric  = step convert_to_numeric(totals: combined)
        step build_summary(numeric_values: numeric)
      end

      private

      def find_space
        space = Spaces::Space.find_by(code: params[:space_code])
        return Failure(space_code: "Space not found") if space.blank?

        Success(space)
      end

      def parse_dates
        start_date = Date.parse(params[:start_date])
        end_date   = Date.parse(params[:end_date])
        return Failure(date: "start_date must be before or equal to end_date") if start_date > end_date

        Success({ start_date:, end_date: })
      rescue Date::Error => e
        Failure(date: "Invalid date format", error: e.message)
      end

      def compute_range_pieces(range:)
        start_d = range[:start_date]
        end_d   = range[:end_date]
        first_month = start_d.beginning_of_month.to_date
        last_month  = end_d.beginning_of_month.to_date

        first_start = nil
        first_end   = nil
        last_start  = nil
        last_end    = nil
        full_month_dates = []

        if first_month == last_month
          # Single month (possibly partial): one transaction query
          first_start = start_d
          first_end   = end_d
        else
          # Partial first month
          if start_d != first_month
            first_start = start_d
            first_end   = first_month.end_of_month.to_date
          end

          # Full months (from cache)
          current = first_month + 1.month
          while current < last_month
            full_month_dates << current.to_date
            current = current + 1.month
          end
          if start_d == first_month
            full_month_dates.unshift(first_month)
          end
          if end_d == last_month.end_of_month.to_date
            full_month_dates << last_month
          end

          # Partial last month
          last_day = last_month.end_of_month.to_date
          if end_d != last_day
            last_start = last_month
            last_end   = end_d
          end
        end

        Success({
          first_start:,
          first_end:,
          last_start:,
          last_end:,
          full_month_dates:
        })
      end

      def aggregate_transactions_for_range(space:, start_date:, end_date:)
        return Success(zeros(space)) if start_date.blank? || end_date.blank?

        transactions = space.transactions.where(
          date: start_date..end_date.end_of_day
        ).calculated

        totals = aggregate_totals_from_transactions(transactions:, space:)
        Success(totals)
      rescue ActiveRecord::ActiveRecordError => e
        Failure(transactions: "Failed to fetch transactions", error: e.message)
      end

      def aggregate_cached_summaries(space:, month_dates:)
        return Success(zeros(space)) if month_dates.blank?

        start_d = month_dates.min
        end_d   = month_dates.max.end_of_month.to_date
        summaries = space.monthly_financial_summaries.in_date_range(
          start_date: start_d,
          end_date:   end_d
        )

        total_income   = summaries.sum(:total_income).to_f
        total_expenses = summaries.sum(:total_expenses).to_f
        Success(
          total_income:   total_income,
          total_expenses: total_expenses,
          net_savings:    total_income - total_expenses
        )
      rescue ActiveRecord::ActiveRecordError => e
        Failure(summaries: "Failed to load cached summaries", error: e.message)
      end

      def combine_totals(first:, last:, cache:)
        ti = 0.0
        te = 0.0
        [first, last, cache].compact.each do |t|
          ti += t[:total_income].to_f
          te += t[:total_expenses].to_f
        end
        Success(
          total_income:   ti,
          total_expenses: te,
          net_savings:    ti - te
        )
      end

      def aggregate_totals_from_transactions(transactions:, space:)
        currency = space.currency.presence || "PHP"
        total_income   = Money.new(0, currency)
        total_expenses = Money.new(0, currency)

        transactions.each do |tx|
          case tx.type
          when "Transactions::Income"
            total_income += tx.amount
          when "Transactions::Expense"
            total_expenses += tx.amount
          end
        end

        {
          total_income:   total_income.amount.to_f,
          total_expenses: total_expenses.amount.to_f,
          net_savings:    (total_income - total_expenses).amount.to_f
        }
      end

      def zeros(space)
        {
          total_income:   0.0,
          total_expenses:  0.0,
          net_savings:     0.0
        }
      end

      def convert_to_numeric(totals:)
        total_income   = totals[:total_income].to_f
        total_expenses = totals[:total_expenses].to_f
        net_savings    = totals[:net_savings].to_f
        savings_percentage = total_income.positive? ? ((net_savings / total_income) * 100).round(2) : 0.0

        Success(
          total_income:,
          total_expenses:,
          net_savings:,
          savings_percentage:
        )
      end

      def build_summary(numeric_values:)
        summary = OpenStruct.new(
          total_income:   numeric_values[:total_income],
          total_expenses: numeric_values[:total_expenses],
          net_savings:    numeric_values[:net_savings],
          savings_percentage: numeric_values[:savings_percentage],
          calculated_at:  Time.current
        )
        Success(summary)
      end
    end
  end
end
