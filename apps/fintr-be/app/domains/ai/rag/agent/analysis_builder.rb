# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      class AnalysisBuilder
        VALID_QUERY_TYPES = %w[
          spending_analysis
          income_analysis
          trend_analysis
          transaction_search
        ].freeze

        VALID_PERIODS = %w[
          this_month
          last_month
          this_week
          last_week
          this_year
          last_year
        ].freeze

        def self.build(
          space_id:,
          query_type: "spending_analysis",
          period: "this_month",
          group_by: nil,
          transaction_type: "expense",
          category: nil,
          search_term: nil,
          semantic_query: nil,
          account: nil,
          limit: 10
        )
          normalized_type = normalize_query_type(query_type)
          normalized_period = normalize_period(period)
          normalized_group_by = normalize_group_by(group_by)
          resolved_transaction_type = resolve_transaction_type(
            query_type: normalized_type,
            transaction_type: transaction_type,
          )

          filters = build_filters(
            transaction_type: resolved_transaction_type,
            category: category,
            search_term: search_term,
            semantic_query: semantic_query,
            account: account,
          )

          aggregations = if normalized_group_by.any?
            {
              group_by: normalized_group_by,
              metrics: %w[sum count],
            }
          else
            {}
          end

          Ai::Rag::AnalysisResult.new(
            query_type: normalized_type,
            data_sources: ["transactions"],
            aggregations: aggregations,
            filters: filters,
            time_range: { period: normalized_period },
            sorting: { field: "amount", direction: "desc" },
            limit: [limit.to_i, 50].min.clamp(1, 50),
            chart_suggestion: { should_include_chart: false },
            space_id: space_id,
          )
        end

        def self.normalize_query_type(value)
          type = value.to_s.strip.downcase
          return type if VALID_QUERY_TYPES.include?(type)

          "spending_analysis"
        end

        def self.normalize_period(value)
          period = value.to_s.strip.downcase
          return period if VALID_PERIODS.include?(period)

          "this_month"
        end

        def self.normalize_group_by(value)
          return [] if value.blank?

          Array(value).map(&:to_s).map(&:downcase).select do |field|
            field.in?(%w[category account month week day description])
          end
        end

        def self.resolve_transaction_type(
          query_type:,
          transaction_type:
        )
          return "income" if query_type == "income_analysis"

          Array(transaction_type.presence || "expense")
        end

        def self.build_filters(
          transaction_type:,
          category:,
          search_term:,
          semantic_query:,
          account:
        )
          filters = {
            transaction_type: Array(transaction_type.presence || "expense"),
          }

          filters[:categories] = Array(category).compact if category.present?
          filters[:search_term] = search_term if search_term.present?
          filters[:semantic_query] = semantic_query if semantic_query.present?
          filters[:accounts] = Array(account).compact if account.present?

          filters
        end

        private_class_method :normalize_query_type,
                             :normalize_group_by,
                             :resolve_transaction_type,
                             :build_filters
      end
    end
  end
end
