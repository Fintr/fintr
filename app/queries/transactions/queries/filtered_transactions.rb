# frozen_string_literal: true

module Transactions
  module Queries
    class FilteredTransactions < BaseQuery
      def call
        relation = joins(@relation)
        relation = by_space(relation, params)
        relation = by_date(relation, params)
        relation = select(relation)
        relation = order(relation)
        paginate(relation, params)
      end

      def joins(relation)
        relation.joins(
          "INNER JOIN accounts ON accounts.id = transactions.account_id",
          "INNER JOIN spaces ON spaces.id = transactions.space_id",
          "INNER JOIN transactions_categories ON transactions_categories.id = transactions.category_id"
        )
      end

      def select(relation)
        relation.select(
          "id",
          "date",
          "amount_cents",
          "amount_currency",
          "transactions.balance_cents as balance_cents",
          "transactions.balance_currency as balance_currency",
          "description",
          "type",
          "accounts.name as account_name",
          "transactions_categories.name as category_name",
        )
      end

      def by_space(relation, params)
        return relation if params[:space_code].blank?

        relation.where(spaces: { code: params[:space_code] })
      end

      def by_date(relation, params)
        return relation if params[:start_date].blank? && params[:end_date].blank?

        if params[:start_date].present? && params[:end_date].blank?
          relation.where(date: params[:start_date]..)
        elsif params[:start_date].blank? && params[:end_date].present?
          relation.where(date: ..params[:end_date])
        else
          relation.where(date: params[:start_date]..params[:end_date])
        end
      end

      def order(relation)
        relation.order(
          date: :asc,
          type: :desc,
          amount_currency: :asc,
          amount_cents: :desc
        )
      end
    end
  end
end
