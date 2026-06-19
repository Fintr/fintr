# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      module Tools
        class SearchTransactions < RubyLLM::Tool
          include Auditable

          MAX_TOOL_CALLS = 6
          SEARCH_LIMIT = 30
          SEARCH_THRESHOLD = 0.65
          SEARCH_CANDIDATE_LIMIT = 150

          description <<~DESC
            Semantic vector search (pgvector) over transaction descriptions and notes.
            Finds semantically related transactions even when the description does not contain the query word.
            Does not replace `query_financial_data` for totals — pair both tools: structured query returns the full sum and breakdown; this tool surfaces relevant descriptions and context.
            Optional `period` scopes results to the same window as structured queries.
            Returns up to #{SEARCH_LIMIT} matches with similarity scores and `[txn:N]` ids.
          DESC

          param :query,
            desc: "Natural-language search query",
            required: true
          param :period,
            desc: "Optional time scope: this_month, last_month, this_week, last_week, this_year, last_year",
            required: false
          param :account,
            desc: "Optional account name filter",
            required: false

          def initialize(
            space_id:,
            collector:,
            vector_searcher: nil
          )
            @space_id = space_id
            @collector = collector
            @vector_searcher = vector_searcher || Rag::VectorSearcher.new
            super()
          end

          def name
            "search_transactions"
          end

          def execute(
            query:,
            period: nil,
            account: nil
          )
            tool_arguments = {
              query: query,
              period: period,
              account: account
            }.compact

            if @collector.limit_reached?(MAX_TOOL_CALLS)
              return audit_and_return(
                arguments: tool_arguments,
                result: limit_message,
              )
            end

            time_range = period.present? ? { period: AnalysisBuilder.normalize_period(period) } : nil
            filters = Rag::SearchScopeFilters.vector_filters_for(
              time_range: time_range,
              filters: {
                account: account,
                transaction_type: ["expense"]
              },
            )

            results = @vector_searcher.search(
              query: query,
              space_id: @space_id,
              filters: filters,
              limit: SEARCH_LIMIT,
              threshold: SEARCH_THRESHOLD,
              candidate_limit: SEARCH_CANDIDATE_LIMIT,
            )

            @collector.record_embeddings(results)

            result = if results.empty?
              "No semantic matches for: #{query}"
            else
              format_results(
                results,
                query: query,
              )
            end

            audit_and_return(
              arguments: tool_arguments,
              result: result,
            )
          rescue StandardError => e
            Rails.logger.warn "[Agent] search_transactions failed: #{e.class}: #{e.message}"
            Rails.logger.warn e.backtrace.first(5).join("\n")
            audit_and_return(
              arguments: tool_arguments,
              result: "Search failed: #{e.message}",
            )
          end

          private

          def format_results(results, query:)
            header = "Semantic matches for \"#{query}\" (#{results.length} shown, ranked by relevance):"
            body = results.map.with_index do |result, index|
              metadata = result[:metadata] || {}
              category = metadata["category"] || metadata[:category]
              subcategory = metadata["subcategory"] || metadata[:subcategory]
              account_name = metadata["account"] || metadata[:account]
              date = metadata["date"] || metadata[:date]
              txn_id = result[:embeddable_id]
              category_label = [category, subcategory].compact.join(", ")
              score = result[:similarity_score]&.round(3)
              description = metadata["description"] || result[:content].to_s.truncate(120)

              "[T#{index + 1}] #{date} #{description} " \
                "(#{category_label}, #{account_name}) " \
                "score=#{score} [txn:#{txn_id}]\n#{result[:content].to_s.truncate(500)}"
            end.join("\n\n")

            "#{header}\n#{body}"
          end

          def limit_message
            "Search limit reached. Answer now with the information you already collected."
          end
        end
      end
    end
  end
end
