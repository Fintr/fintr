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
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call
        params   = step validate(params: @params)
        space    = step load_space(params:)
        relation = step by_space(relation: @relation, params:)
        relation = step by_calculated_state(relation:)
        relation = step without_initial_balance(relation:)
        relation = step by_date(relation:, params:)
        step aggregate_by_month(relation:, space:)
      end

      private

      def load_space(params:)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(space_id: "Not found") if space.blank?

        Success(space)
      end

      def by_space(relation:, params:)
        relation = relation.where(space_id: params[:space_id])
        Success(relation)
      end

      def by_date(relation:, params:)
        relation = relation
                    .where(date: params[:date_from].beginning_of_month..(Time.zone.now).end_of_month)
        Success(relation)
      end

      def by_calculated_state(relation:)
        relation = relation.calculated
        Success(relation)
      end

      def without_initial_balance(relation:)
        relation = relation
                    .joins(:category)
                    .where.not(transactions_categories: { name: "Initial Balance" })
        Success(relation)
      end

      def aggregate_by_month(relation:, space:)
        buckets = Hash.new { |h, k| h[k] = { income: 0.to_d, expense: 0.to_d } }

        relation.includes(:space, :currency_conversion).find_each do |transaction|
          month_start = transaction.date.to_date.beginning_of_month
          amount = transaction.amount_numeric_for_space_total.to_d

          case transaction.type
          when "Transactions::Income"
            buckets[month_start][:income] += amount
          when "Transactions::Expense"
            buckets[month_start][:expense] += amount
          end
        end

        rows = buckets.sort_by { |(month, _)| month }.map do |month_start, totals|
          income = totals[:income]
          expense = totals[:expense]

          Row.new(
            month_year: month_start.in_time_zone,
            total_income: income.round(2),
            total_expense: expense.round(2),
            net_amount: (income - expense).round(2)
          )
        end

        Success(rows)
      rescue StandardError => e
        Failure(aggregate_by_month: "Failed to aggregate monthly spending", error: e.message)
      end
    end
  end
end
