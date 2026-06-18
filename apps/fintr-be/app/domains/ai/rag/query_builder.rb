# frozen_string_literal: true

module Ai
  module Rag
    # Builds database queries for different analysis types.
    # Required on analysis: space_id (to scope transactions), filters (transaction_type, etc.), time_range (period).
    # Optional: aggregations (group_by, metrics), sorting, limit.
    class QueryBuilder
      def for_spending(analysis)
        base_query(analysis)
          .then { |q| TopicFilter.join_tables(q) }
          .then { |q| apply_transaction_type_filter(q, analysis.filters) }
          .then { |q| apply_topic_filter(q, filters: analysis.filters, analysis: analysis) }
          .then { |q| apply_account_filter(q, analysis.filters) }
          .then { |q| apply_amount_filter(q, analysis.filters) }
          .then { |q| apply_time_range_filter(q, analysis.time_range) }
          .then { |q| exclude_initial_balance(q) }
      end

      def for_trends(analysis)
        for_spending(analysis)
      end

      def for_transactions(analysis)
        base_query(analysis)
          .then { |q| TopicFilter.join_tables(q) }
          .then { |q| apply_transaction_type_filter(q, analysis.filters) }
          .then { |q| apply_topic_filter(q, filters: analysis.filters, analysis: analysis) }
          .then { |q| apply_account_filter(q, analysis.filters) }
          .then { |q| apply_time_range_filter(q, analysis.time_range) }
          .then { |q| exclude_initial_balance(q) }
          .then { |q| apply_sorting(q, analysis.sorting) }
      end

      private

      def base_query(analysis)
        space = Spaces::Space.find_by(id: analysis.space_id)
        raise ArgumentError, "Space not found: #{analysis.space_id}" unless space

        space.transactions.includes(:category, :account)
      end

      def exclude_initial_balance(query)
        query.where.not(transactions_categories: { name: "Initial Balance" })
      end

      def apply_transaction_type_filter(query, filters)
        return query unless filters&.dig(:transaction_type)&.any?

        types = filters[:transaction_type].map do |type|
          case type
          when "expense" then "Transactions::Expense"
          when "income" then "Transactions::Income"
          when "transfer" then "Transactions::Transfer"
          else type
          end
        end

        query.where(type: types)
      end

      def apply_topic_filter(
        query,
        filters:,
        analysis:
      )
        topic_terms = topic_terms_from_filters(filters)
        semantic_query = semantic_query_from_filters(filters, topic_terms: topic_terms)
        return query if topic_terms.empty? && semantic_query.blank?

        text_ids = if topic_terms.any?
          TopicFilter.apply(query, terms: topic_terms).pluck(:id)
        else
          []
        end

        semantic_ids = if semantic_query.present?
          SemanticTransactionResolver.new.resolve(
            query: semantic_query,
            space_id: analysis.space_id,
            time_range: analysis.time_range,
            filters: filters,
            limit: SemanticTransactionResolver::AGGREGATE_LIMIT,
            candidate_limit: SemanticTransactionResolver::AGGREGATE_CANDIDATE_LIMIT,
          )
        else
          []
        end

        combined_ids = (text_ids + semantic_ids).uniq
        return query.none if combined_ids.empty?

        query.where(id: combined_ids)
      end

      def semantic_query_from_filters(filters, topic_terms:)
        filters[:semantic_query].presence ||
          filters[:search_term].presence ||
          (topic_terms.any? ? topic_terms.join(" ") : nil)
      end

      def topic_terms_from_filters(filters)
        terms = []
        terms.concat(Array(filters[:topic_terms])) if filters&.dig(:topic_terms).present?
        terms.concat(Array(filters[:categories])) if filters&.dig(:categories).present?
        terms << filters[:search_term] if filters&.dig(:search_term).present?
        terms << filters[:category] if filters&.dig(:category).present?
        terms.concat(Array(filters[:descriptions])) if filters&.dig(:descriptions).present?
        TopicFilter.normalize_terms(terms)
      end

      def apply_account_filter(query, filters)
        return query unless filters&.dig(:accounts)&.any?

        query.where(
          "accounts.name ILIKE ANY(ARRAY[?])",
          filters[:accounts].map { |a| "%#{a}%" },
        )
      end

      def apply_amount_filter(query, filters)
        range = filters&.dig(:amount_range)
        return query unless range

        query = query.where("amount_cents >= ?", range[:min] * 100) if range[:min]
        query = query.where("amount_cents <= ?", range[:max] * 100) if range[:max]

        query
      end

      def apply_time_range_filter(query, time_range)
        return query unless time_range

        case time_range[:period]
        when "this_month"
          query.where(date: Date.current.all_month)
        when "last_month"
          query.where(date: Date.current.last_month.all_month)
        when "this_week"
          query.where(date: Date.current.all_week)
        when "last_week"
          query.where(date: Date.current.last_week.all_week)
        when "this_year"
          query.where(date: Date.current.all_year)
        when "last_year"
          query.where(date: Date.current.last_year.all_year)
        when "custom"
          apply_custom_date_range(query, time_range)
        else
          query
        end
      end

      def apply_custom_date_range(query, time_range)
        start_date = parse_date(time_range[:start_date])
        end_date = parse_date(time_range[:end_date])&.end_of_day

        if start_date && end_date
          query.where(date: start_date..end_date)
        elsif start_date
          query.where("date >= ?", start_date)
        elsif end_date
          query.where("date <= ?", end_date)
        else
          query
        end
      end

      def parse_date(date_string)
        return nil unless date_string.present?

        Date.parse(date_string)
      rescue Date::Error
        nil
      end

      def apply_sorting(query, sorting)
        return query unless sorting

        field = sorting[:field] || "date"
        direction = sorting[:direction] || "desc"

        case field
        when "amount"
          query.order(amount_cents: direction)
        when "date"
          query.order(date: direction, created_at: :desc)
        else
          query.order(created_at: :desc)
        end
      end
    end
  end
end
