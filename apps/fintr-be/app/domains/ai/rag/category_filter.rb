# frozen_string_literal: true

module Ai
  module Rag
    # Shared category/subcategory filtering for RAG retrieval.
    # Transactions store parent category on category_id and labels like "Coffee" on subcategory_id.
    class CategoryFilter
      SUBCATEGORY_JOIN = <<~SQL.squish
        LEFT JOIN transactions_categories subcategory_categories
          ON subcategory_categories.id = transactions.subcategory_id
      SQL

      class << self
        def join_category_tables(query)
          query
            .joins(:category)
            .joins(SUBCATEGORY_JOIN)
        end

        def apply_category_names(query, category_names:)
          names = Array(category_names).map(&:to_s).reject(&:blank?)
          return query if names.empty?

          patterns = names.map { |name| "%#{sanitize_like(name)}%" }

          query.where(
            "transactions_categories.name ILIKE ANY (ARRAY[?]) " \
            "OR subcategory_categories.name ILIKE ANY (ARRAY[?])",
            patterns,
            patterns,
          )
        end

        def apply_to_transactions(query, category_names:)
          join_category_tables(query)
            .then { |scoped| apply_category_names(scoped, category_names: category_names) }
        end

        def apply_to_embeddings(scope, category_name:)
          name = category_name.to_s.strip
          return scope if name.blank?

          pattern = "%#{sanitize_like(name)}%"

          scope.where(
            "metadata->>'category' ILIKE ? OR metadata->>'subcategory' ILIKE ?",
            pattern,
            pattern,
          )
        end

        private

        def sanitize_like(value)
          ActiveRecord::Base.sanitize_sql_like(value)
        end
      end
    end
  end
end
