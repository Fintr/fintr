# frozen_string_literal: true

module Ai
  module Rag
    # Matches the transactions UI search: description, parent category, subcategory, and account.
    class TopicFilter
      SUBCATEGORY_JOIN = CategoryFilter::SUBCATEGORY_JOIN

      class << self
        def join_tables(query)
          query
            .joins(:category)
            .joins(SUBCATEGORY_JOIN)
            .joins(:account)
        end

        def apply(query, terms:)
          topic_terms = normalize_terms(terms)
          return query if topic_terms.empty?

          patterns = topic_terms.map { |term| "%#{sanitize_like(term)}%" }

          query.where(
            "transactions.description ILIKE ANY (ARRAY[?]) " \
            "OR transactions_categories.name ILIKE ANY (ARRAY[?]) " \
            "OR subcategory_categories.name ILIKE ANY (ARRAY[?]) " \
            "OR accounts.name ILIKE ANY (ARRAY[?])",
            patterns,
            patterns,
            patterns,
            patterns,
          )
        end

        def apply_to_embeddings(scope, terms:)
          topic_terms = normalize_terms(terms)
          return scope if topic_terms.empty?

          patterns = topic_terms.map { |term| "%#{sanitize_like(term)}%" }

          scope.where(
            "content ILIKE ANY (ARRAY[?]) " \
            "OR metadata->>'category' ILIKE ANY (ARRAY[?]) " \
            "OR metadata->>'subcategory' ILIKE ANY (ARRAY[?]) " \
            "OR metadata->>'account' ILIKE ANY (ARRAY[?])",
            patterns,
            patterns,
            patterns,
            patterns,
          )
        end

        def normalize_terms(terms)
          Array(terms)
            .map { |term| term.to_s.strip }
            .reject(&:blank?)
            .uniq
        end

        def terms_from_agent_filters(filters)
          terms = []
          terms << filters[:search_term] if filters[:search_term].present?
          terms << filters[:category] if filters[:category].present?
          terms.concat(Array(filters[:categories])) if filters[:categories].present?
          terms.concat(Array(filters[:topic_terms])) if filters[:topic_terms].present?
          normalize_terms(terms)
        end

        private

        def sanitize_like(value)
          ActiveRecord::Base.sanitize_sql_like(value)
        end
      end
    end
  end
end
