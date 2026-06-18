# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      # Builds or enriches user-facing answers from tool results when the model response is blank or too thin.
      class ResponseFallbackBuilder
        TOTAL_PATTERN = /Total:\s*(.+?)\s+across\s+(\d+)\s+transactions/mi
        TRANSACTION_LINE_PATTERN = /
          ^-\s+
          (?<date>.+?):\s+
          (?<description>.+?)\s+
          [\u2014-]\s+
          (?<amount>₱[\d,.]+)
        /ux
        DEFAULT_MESSAGE = "I looked up your data but couldn't generate a summary. Please try asking again."

        PERIOD_LABELS = {
          "this_month" => "this month",
          "last_month" => "last month",
          "this_week" => "this week",
          "last_week" => "last week",
          "this_year" => "this year",
          "last_year" => "last year",
        }.freeze

        def self.build(agent_result)
          content = agent_result[:content].to_s.strip
          tool_answer = build_rich_answer(agent_result[:tool_calls])

          if tool_answer.present?
            return tool_answer if content.blank?
            return tool_answer unless sufficiently_detailed?(
              content: content,
              tool_answer: tool_answer,
            )
          end

          content.presence || DEFAULT_MESSAGE
        end

        def self.build_rich_answer(tool_call_trail)
          summary_from_tool_calls(tool_call_trail)
        end

        def self.summary_from_tool_calls(tool_call_trail)
          entries = Array(tool_call_trail)
          return nil if entries.empty?

          financial_entry = entries.reverse.find do |entry|
            (entry[:name] || entry["name"]) == "query_financial_data"
          end

          if financial_entry
            financial_answer = answer_from_financial_result(financial_entry)
            return financial_answer if financial_answer.present?
          end

          search_entry = entries.reverse.find do |entry|
            (entry[:name] || entry["name"]) == "search_transactions"
          end

          return nil unless search_entry

          answer_from_search_result(search_entry)
        end

        def self.sufficiently_detailed?(content:, tool_answer:)
          return false unless content_has_breakdown?(content)

          tool_total = extract_total_amount(tool_answer)
          tool_count = extract_transaction_count(tool_answer)

          if tool_total.present?
            return false unless amounts_match?(
              content: content,
              amount: tool_total,
            )
          end

          if tool_count.present?
            return false unless content.match?(/\b#{Regexp.escape(tool_count.to_s)}\b/)
          end

          true
        end

        def self.content_has_breakdown?(content)
          return false if content.lines.size < 3

          content.include?("Breakdown") ||
            content.count("- ") >= 2 ||
            content.scan(/^\*\s+/).size >= 2
        end

        def self.answer_from_financial_result(entry)
          result = (entry[:result] || entry["result"]).to_s
          match = result.match(TOTAL_PATTERN)
          return answer_from_transaction_list(result, entry) unless match

          total = match[1].strip
          count = match[2].strip
          period = result[/Results for \w+ \(([^)]+)\)/, 1]
          breakdown = extract_breakdown(result)

          summary = if period.present?
            "For #{human_period(period)}, you had #{count} matching purchases totaling #{total}."
          else
            "You had #{count} matching purchases totaling #{total}."
          end

          breakdown.present? ? "#{summary}\n\nBreakdown:\n#{breakdown}" : summary
        end

        def self.answer_from_transaction_list(result, entry)
          transactions = parse_transaction_lines(result)
          return nil if transactions.empty?

          period = result[/Results for \w+ \(([^)]+)\)/, 1]
          build_transaction_list_answer(
            transactions: transactions,
            period: period,
            topic: topic_from_arguments(entry),
          )
        end

        def self.answer_from_search_result(entry)
          result = (entry[:result] || entry["result"]).to_s
          return nil if result.blank? || result.start_with?("No semantic matches")

          transactions = parse_semantic_transaction_lines(result)
          return nil if transactions.empty?

          period = entry.dig(:arguments, "period") || entry.dig(:arguments, :period)
          build_transaction_list_answer(
            transactions: transactions,
            period: period,
            topic: entry.dig(:arguments, "query") || entry.dig(:arguments, :query),
          )
        end

        def self.build_transaction_list_answer(transactions:, period:, topic:)
          total_cents = transactions.sum { |transaction| transaction[:amount_cents] }
          total = Money.new(total_cents).format
          count = transactions.size
          breakdown_rows = TopicBreakdownBuilder.build(transactions)
          breakdown = format_breakdown(breakdown_rows)
          topic_label = topic.present? ? " for #{topic}" : ""

          summary = if period.present?
            "For #{human_period(period)}, you had #{count} matching purchases#{topic_label} totaling #{total}."
          else
            "You had #{count} matching purchases#{topic_label} totaling #{total}."
          end

          "#{summary}\n\nBreakdown:\n#{breakdown}"
        end

        def self.format_breakdown(rows)
          rows.map do |row|
            "- #{row[:label]}: #{row[:total]} (#{row[:count]} transactions)"
          end.join("\n")
        end

        def self.extract_breakdown(result)
          lines = result.lines.map(&:strip)
          start_index = lines.index("Breakdown:")
          return nil unless start_index

          lines[(start_index + 1)..].take_while { |line| line.start_with?("- ") }.join("\n")
        end

        def self.parse_transaction_lines(result)
          result.lines.filter_map do |line|
            match = line.strip.match(TRANSACTION_LINE_PATTERN)
            next unless match

            {
              description: match[:description].strip,
              amount_cents: parse_peso_to_cents(match[:amount]),
              date: match[:date].strip,
            }
          end
        end

        def self.parse_semantic_transaction_lines(result)
          result.lines.filter_map do |line|
            match = line.match(
              /
                ^\[T\d+\]\s+
                (?<date>\S+)\s+
                (?<description>.+?)\.\s+
                -(?<amount>₱[\d,.]+)
              /ix,
            )
            next unless match

            {
              description: match[:description].strip,
              amount_cents: parse_peso_to_cents(match[:amount]),
              date: match[:date].strip,
            }
          end
        end

        def self.parse_peso_to_cents(amount)
          numeric = amount.to_s.delete("₱,")
          (numeric.to_d * 100).to_i
        end

        def self.extract_total_amount(text)
          match = text.match(TOTAL_PATTERN)
          return match[1].strip if match

          text[/totaling (₱[\d,.]+)/i, 1]
        end

        def self.extract_transaction_count(text)
          match = text.match(TOTAL_PATTERN)
          return match[2].strip.to_i if match

          text[/\b(\d+)\s+matching purchases/i, 1]&.to_i ||
            text[/\b(\d+)\s+transactions/i, 1]&.to_i
        end

        def self.amounts_match?(content:, amount:)
          normalized_amount = amount.to_s.delete(",")
          content.delete(",").include?(normalized_amount.delete("₱"))
        end

        def self.human_period(period)
          PERIOD_LABELS.fetch(period.to_s, period.to_s.tr("_", " "))
        end

        def self.topic_from_arguments(entry)
          arguments = entry[:arguments] || entry["arguments"] || {}
          arguments[:search_term] || arguments["search_term"] ||
            arguments[:category] || arguments["category"]
        end

        private_class_method :answer_from_financial_result,
          :answer_from_transaction_list,
          :answer_from_search_result,
          :build_transaction_list_answer,
          :format_breakdown,
          :extract_breakdown,
          :parse_transaction_lines,
          :parse_semantic_transaction_lines,
          :parse_peso_to_cents,
          :extract_total_amount,
          :extract_transaction_count,
          :amounts_match?,
          :human_period,
          :topic_from_arguments
      end
    end
  end
end
