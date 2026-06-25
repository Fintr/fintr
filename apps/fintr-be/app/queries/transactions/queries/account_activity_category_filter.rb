# frozen_string_literal: true

module Transactions
  module Queries
    module AccountActivityCategoryFilter
      include CategoryFilterTokens

      SUBCATEGORY_EXISTS_SQL = <<~SQL.squish
        EXISTS (
          SELECT 1
          FROM transactions activity_subcat_tx
          WHERE activity_subcat_tx.id = account_activities.activitable_id
            AND account_activities.activitable_type IN (
              'Transactions::Income',
              'Transactions::Expense'
            )
            AND activity_subcat_tx.subcategory_id = ?
        )
      SQL

      private

      def apply_account_activity_category_filters(relation, params)
        return Success(relation) if account_activity_category_filter_blank?(params)

        tokens = CategoryFilterTokens.normalize(params)
        if tokens.any?
          return Success(build_account_activity_category_or_scope(relation, tokens))
        end

        if params[:category_name].present? && !["all", ""].include?(params[:category_name])
          return Success(relation.where(category_name: params[:category_name]))
        end

        Success(relation)
      end

      def account_activity_category_filter_blank?(params)
        CategoryFilterTokens.legacy_blank?(params)
      end

      def build_account_activity_category_or_scope(relation, tokens)
        clauses = []
        binds = []

        tokens.each do |token|
          category_id, subcategory_id = token.split(":", 2)

          if subcategory_id.present?
            clauses << "(account_activities.category_id = ? AND #{SUBCATEGORY_EXISTS_SQL})"
            binds << category_id
            binds << subcategory_id
          else
            clauses << "account_activities.category_id = ?"
            binds << category_id
          end
        end

        relation.where(clauses.join(" OR "), *binds)
      end
    end
  end
end
