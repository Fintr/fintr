# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      module Tools
        class QueryFinancialData < RubyLLM::Tool
          include Auditable

          MAX_TOOL_CALLS = 6

          description <<~DESC
            Query structured financial data from the database (SQL): totals, grouped spending/income, trends, or transaction lists.
            Use for "how much", "how many", "top categories", "compare months", and aggregate questions.
            For count/total/topic questions, use `query_type: spending_analysis` with `search_term` — NOT `transaction_search`.
            `transaction_search` is only when the user explicitly asks to list or browse individual rows.
            Pair with `search_transactions` for the same question — structured data gives accurate numbers;
            vector search adds merchant names, descriptions, and semantic matches.
            `query_type`: spending_analysis, income_analysis, trend_analysis, or transaction_search.
            `period`: this_month, last_month, this_week, last_week, this_year, last_year.
            `group_by`: optional — category, account, month, week, or day.
            For topic questions, use `search_term` — it matches description, category, subcategory,
            and account like the transactions UI search, and also unions strong semantic matches.
            `spending_analysis` without `group_by` returns the total sum, count, merchant breakdown, and a sample.
          DESC

          param :query_type,
            desc: "spending_analysis, income_analysis, trend_analysis, or transaction_search",
            required: true
          param :period,
            desc: "Time period (e.g. this_month, last_month)",
            required: true
          param :group_by,
            desc: "Optional grouping: category, account, month, week, day",
            required: false
          param :transaction_type,
            desc: "expense or income",
            required: false
          param :account,
            desc: "Optional account filter",
            required: false
          param :category,
            desc: "Optional topic filter — matches description, parent category, subcategory, or account",
            required: false
          param :search_term,
            desc: "Topic filter (preferred for description/category searches). Includes semantic matches.",
            required: false
          param :semantic_query,
            desc: "Optional override for semantic matching (defaults to search_term or category)",
            required: false
          param :limit,
            type: "integer",
            desc: "Max rows to return (default 10)",
            required: false

          def initialize(
            space_id:,
            collector:,
            data_retriever: nil
          )
            @space_id = space_id
            @collector = collector
            @data_retriever = data_retriever || Rag::DataRetriever.new
            super()
          end

          def name
            "query_financial_data"
          end

          def execute(
            query_type:,
            period:,
            group_by: nil,
            transaction_type: "expense",
            category: nil,
            search_term: nil,
            semantic_query: nil,
            account: nil,
            limit: 10
          )
            tool_arguments = {
              query_type: query_type,
              period: period,
              group_by: group_by,
              transaction_type: transaction_type,
              category: category,
              search_term: search_term,
              semantic_query: semantic_query,
              account: account,
              limit: limit
            }.compact

            if @collector.limit_reached?(MAX_TOOL_CALLS)
              return audit_and_return(
                arguments: tool_arguments,
                result: limit_message,
              )
            end

            analysis = AnalysisBuilder.build(
              space_id: @space_id,
              query_type: query_type,
              period: period,
              group_by: group_by,
              transaction_type: transaction_type,
              category: category,
              search_term: search_term,
              semantic_query: semantic_query,
              account: account,
              limit: limit,
            )

            data = @data_retriever.retrieve(analysis)
            @collector.record_structured_data(data)

            result = if data.blank?
              "No data found for #{query_type} (#{period})."
            else
              format_data(data, analysis)
            end

            audit_and_return(
              arguments: tool_arguments,
              result: result,
            )
          rescue StandardError => e
            Rails.logger.warn "[Agent] query_financial_data failed: #{e.class}: #{e.message}"
            Rails.logger.warn e.backtrace.first(5).join("\n")
            audit_and_return(
              arguments: tool_arguments,
              result: "Query failed: #{e.message}",
            )
          end

          private

          def format_data(data, analysis)
            header = "Results for #{analysis.query_type} (#{analysis.time_range[:period]}):"
            body = if data.first.is_a?(Hash) && data.first[:aggregate]
              format_aggregate(data.first)
            elsif data.first.is_a?(Hash) && data.first.key?(:group)
              format_grouped(data)
            else
              format_transactions(data)
            end

            "#{header}\n#{body}"
          end

          def format_aggregate(item)
            lines = [
              "Total: #{item[:total]} across #{item[:count]} transactions"
            ]

            if item[:topic_breakdown].present?
              lines << "Breakdown:"
              item[:topic_breakdown].each do |row|
                lines << "- #{row[:label]}: #{row[:total]} (#{row[:count]} transactions)"
              end
            end

            if item[:transactions].present?
              lines << "Sample transactions:"
              lines << format_transactions(item[:transactions])
            end

            lines.join("\n")
          end

          def format_grouped(data)
            data.map do |item|
              group_name = item[:group].is_a?(Array) ? item[:group].join(" - ") : item[:group]
              amount = item.dig(:sum, :amount) || "N/A"
              count = item[:count] || 0
              "- #{group_name}: #{amount} (#{count} transactions)"
            end.join("\n")
          end

          def format_transactions(data)
            data.map do |txn|
              "- #{txn[:date]}: #{txn[:description]} — #{txn[:amount]} (#{txn[:category]}) [txn:#{txn[:id]}]"
            end.join("\n")
          end

          def limit_message
            "Query limit reached. Answer now with the information you already collected."
          end
        end
      end
    end
  end
end
