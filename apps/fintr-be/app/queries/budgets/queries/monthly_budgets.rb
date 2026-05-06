# frozen_string_literal: true

module Budgets
  module Queries
    class MonthlyBudgets < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
          required(:start_date).value(:date)
          required(:end_date).value(:date)
        end

        rule(:start_date, :end_date) do
          if values[:start_date] > values[:end_date]
            key(:end_date).failure("must be after start_date")
          end
        end
      end

      def validate
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        @space = Spaces::Space.find_by(code: params[:space_code])
        return Failure(space_code: "Not found") if @space.blank?

        Success(contract.to_h)
      end

      def call
        params    = step validate
        relation  = step by_space(@relation, params)
        relation  = step by_date_range(relation, params)
        relation  = step joins(relation, params)
        relation  = step group(relation)
        step select(relation)
      end

      attr_reader :space

      private

      def by_space(relation, params)
        Success(relation.where(space:))
      end

      # NOTE: This should always include the budgets for the entire month. If a budget is created at 15th,
      # and you selected on the 14th, it should be included as the budget because we only have 1 budget
      # record for the month per category.
      def by_date_range(relation, params)
        start_date = params[:start_date].to_date.beginning_of_month
        end_date = params[:end_date].to_date.end_of_month
        Success(relation.where(date: start_date..end_date))
      end

      def joins(relation, params)
        start_date = params[:start_date].to_date
        end_date = params[:end_date].to_date

        # Create a subquery for budget totals per category per month
        # This prevents budget amounts from being multiplied by transaction counts
        # Since there's only one budget per category per month, we use MAX
        # Use the already-filtered relation to ensure consistency
        budget_totals_subquery = relation.select(
          "budgets.category_id",
          "DATE_TRUNC('month', budgets.date) as budget_month",
          "MAX(budgets.amount_cents) as budget_amount_cents",
          "MAX(budgets.amount_currency) as budget_amount_currency",
          "MIN(budgets.date) as budget_date",
          "(array_agg(budgets.id))[1] as budget_id",
          "(array_agg(budgets.space_id))[1] as budget_space_id",
          "MAX(budgets.created_at) as budget_created_at",
          "MAX(budgets.updated_at) as budget_updated_at"
        )
                              .group("budgets.category_id", "DATE_TRUNC('month', budgets.date)")
                              .to_sql

        # Create a subquery for transaction totals per category
        # This aggregates transactions separately to avoid multiplying budget rows
        transaction_totals_subquery = "SELECT
          transactions.category_id,
          COALESCE(SUM(transactions.amount_cents), 0) / 100 as total_spent
        FROM transactions
        INNER JOIN spaces ON spaces.id = transactions.space_id
        WHERE transactions.balance_state = 'calculated'
          AND transactions.date >= '#{start_date}'
          AND transactions.date <= '#{end_date}'
          AND spaces.id = '#{@space.id}'
        GROUP BY transactions.category_id"

        # Join with aggregated subqueries instead of raw transaction rows
        # This prevents budget amounts from being multiplied
        # budget_totals is already aggregated (one row per category per month)
        # transaction_totals is already aggregated (one row per category)
        relation = relation.joins(
          :space,
          "INNER JOIN transactions_categories ON transactions_categories.id = budgets.category_id",
          "INNER JOIN (#{budget_totals_subquery}) budget_totals ON budget_totals.category_id = budgets.category_id AND DATE_TRUNC('month', budgets.date) = budget_totals.budget_month",
          "LEFT OUTER JOIN (#{transaction_totals_subquery}) transaction_totals ON transaction_totals.category_id = transactions_categories.id"
        )
        Success(relation)
      rescue StandardError
        Failure(:join_error)
      end

      def select(relation)
        relation = relation.select(
          "budgets.category_id",
          "(array_agg(budget_totals.budget_id ORDER BY budget_totals.budget_date))[1] as id",
          "(array_agg(budget_totals.budget_space_id ORDER BY budget_totals.budget_date))[1] as space_id",
          "MIN(budget_totals.budget_date) as date",
          "MAX(budget_totals.budget_amount_currency) as amount_currency",
          "MAX(budget_totals.budget_created_at) as created_at",
          "MAX(budget_totals.budget_updated_at) as updated_at",
          "transactions_categories.name as category_name",
          "COALESCE(SUM(budget_totals.budget_amount_cents), 0) as amount_cents",
          "COALESCE(MAX(transaction_totals.total_spent), 0) as total_spent"
        )
        Success(relation)
      rescue StandardError
        Failure(:select_error)
      end

      def group(relation)
        # Group by category to aggregate budgets across multiple months
        relation = relation.group(
          "budgets.category_id",
          "transactions_categories.name"
        )
        Success(relation)
      rescue StandardError
        Failure(:group_error)
      end
    end
  end
end
