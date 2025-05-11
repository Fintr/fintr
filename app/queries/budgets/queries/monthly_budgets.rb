# frozen_string_literal: true

module Budgets
  module Queries
    class MonthlyBudgets < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
          required(:date).value(:date)
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
        relation  = step by_date(relation, params)
        relation  = step joins(relation)
        relation  = step by_transactions(relation)
        relation  = step group(relation)

        step select(relation)
      end

      attr_reader :space

      private

      def by_space(relation, params)
        Success(relation.where(space:))
      end

      def by_date(relation, params)
        Success(relation.where(date: params[:date].to_date.all_month))
      end

      def joins(relation)
        relation = relation.joins(
          :space,
          "INNER JOIN transactions_categories ON transactions_categories.id = budgets.category_id",
          "LEFT OUTER JOIN transactions ON transactions.category_id = transactions_categories.id"
        )
        Success(relation)
      rescue StandardError
        Failure(:join_error)
      end

      def by_transactions(relation)
        Success(relation.where(transactions: { balance_state: "calculated", date: params[:date].to_date.all_month }))
      rescue StandardError
        Failure(:by_transactions_error)
      end

      def select(relation)
        relation = relation.select(
          "budgets.*",
          "transactions_categories.name as category_name",
          "COALESCE(SUM(transactions.amount_cents), 0) / 100 as total_spent"
        )
        Success(relation)
      rescue StandardError
        Failure(:select_error)
      end

      def group(relation)
        relation = relation.group(
          "budgets.id",
          "transactions_categories.name"
        )
        Success(relation)
      rescue StandardError
        Failure(:group_error)
      end
    end
  end
end
