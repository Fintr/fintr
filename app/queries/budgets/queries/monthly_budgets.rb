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

        relation = relation.joins(
          :space,
          "INNER JOIN transactions_categories ON transactions_categories.id = budgets.category_id",
          "LEFT OUTER JOIN transactions ON transactions.category_id = transactions_categories.id AND transactions.balance_state = 'calculated' AND transactions.date >= '#{start_date}' AND transactions.date <= '#{end_date}'"
        )
        Success(relation)
      rescue StandardError
        Failure(:join_error)
      end

      def select(relation)
        relation = relation.select(
          "budgets.category_id",
          "(array_agg(budgets.id ORDER BY budgets.id))[1] as id",
          "(array_agg(budgets.space_id ORDER BY budgets.id))[1] as space_id",
          "MIN(budgets.date) as date",
          "MAX(budgets.amount_currency) as amount_currency",
          "MAX(budgets.created_at) as created_at",
          "MAX(budgets.updated_at) as updated_at",
          "transactions_categories.name as category_name",
          "COALESCE(SUM(budgets.amount_cents), 0) as amount_cents",
          "COALESCE(SUM(transactions.amount_cents), 0) / 100 as total_spent"
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
