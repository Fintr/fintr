# frozen_string_literal: true

module Insights
  module Queries
    class MonthlySpending < BaseQuery
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
        params    = step validate(params: @params)
        relation  = step by_space(relation: @relation, params:)
        relation  = step by_calculated_state(relation:)
        relation  = step without_initial_balance(relation:)
        relation  = step by_date(relation:, params:)
        relation  = step group_by_month(relation:)
        relation  = step select_data(relation:)
        relation  = step order(relation:)
        relation
      end

      private

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

      def group_by_month(relation:)
        relation = relation.group("DATE_TRUNC('month', date)", "amount_currency")
        Success(relation)
      end

      def select_data(relation:)
        relation = relation
                    .select(
                      "DATE_TRUNC('month', date) AS month_year",
                      "SUM(CASE WHEN type = 'Transactions::Income' THEN amount_cents ELSE 0 END) / 100 AS total_income",
                      "SUM(CASE WHEN type = 'Transactions::Expense' THEN amount_cents ELSE 0 END) / 100 AS total_expense",
                      "SUM(CASE WHEN type = 'Transactions::Income' THEN amount_cents ELSE -amount_cents END) / 100 AS net_amount",
                      "amount_currency"
                    )
        Success(relation)
      rescue StandardError => e
        Failure(group_by_month: "Failed to group by month", error: e.message)
      end

      def order(relation:)
        relation = relation.order(Arel.sql("DATE_TRUNC('month', date) ASC"))
        Success(relation)
      end
    end
  end
end
