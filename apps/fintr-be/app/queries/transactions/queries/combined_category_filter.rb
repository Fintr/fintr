# frozen_string_literal: true

module Transactions
  module Queries
    module CombinedCategoryFilter
      include CategoryFilterTokens

      SUBCATEGORY_EXISTS_SQL = <<~SQL.squish
        EXISTS (
          SELECT 1
          FROM transactions category_filter_tx
          WHERE category_filter_tx.id = combined_transactions.transactable_id
            AND combined_transactions.transactable_type IN (
              'Transactions::Income',
              'Transactions::Expense'
            )
            AND category_filter_tx.subcategory_id = ?
        )
      SQL

      private

      def combined_category_filter_blank?(params)
        CategoryFilterTokens.legacy_blank?(params)
      end

      def apply_combined_category_filters(relation, params)
        return Success(relation) if combined_category_filter_blank?(params)

        tokens = CategoryFilterTokens.normalize(params)
        if tokens.any?
          return Success(build_combined_category_or_scope(relation, tokens))
        end

        if params[:category_name].present? && !["all", ""].include?(params[:category_name])
          return Success(relation.where(category_name: params[:category_name]))
        end

        Success(relation)
      end

      def build_combined_category_or_scope(relation, tokens)
        clauses = []
        binds = []

        tokens.each do |token|
          category_id, subcategory_id = token.split(":", 2)

          if subcategory_id.present?
            clauses << "(combined_transactions.category_id = ? AND #{SUBCATEGORY_EXISTS_SQL})"
            binds << category_id
            binds << subcategory_id
          else
            clauses << "combined_transactions.category_id = ?"
            binds << category_id
          end
        end

        relation.where(clauses.join(" OR "), *binds)
      end
    end
  end
end
