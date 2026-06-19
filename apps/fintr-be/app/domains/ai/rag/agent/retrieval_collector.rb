# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      class RetrievalCollector
        MAX_RESULT_LENGTH = 4_000

        attr_reader :cited_embedding_ids,
                    :steps,
                    :tool_call_trail,
                    :reasoning_notes

        def initialize
          @cited_embedding_ids = []
          @seen_embedding_ids = {}
          @steps = []
          @tool_call_count = 0
          @tool_call_trail = []
          @reasoning_notes = []
          @searched = false
        end

        def record_embeddings(embeddings)
          @searched = true

          Array(embeddings).each do |embedding|
            id = embedding.is_a?(Hash) ? embedding[:id] : embedding.id
            next if id.blank? || @seen_embedding_ids[id]

            @seen_embedding_ids[id] = true
            @cited_embedding_ids << id
          end
        end

        def record_structured_data(data)
          @searched = true if Array(data).any?
        end

        def record_tool_call(
          name:,
          arguments:,
          result:
        )
          @tool_call_count += 1

          serialized_result = serialize_result(result)
          truncated = serialized_result.length > MAX_RESULT_LENGTH

          entry = {
            name: name,
            arguments: normalize_arguments(arguments),
            result: truncated ? serialized_result.truncate(MAX_RESULT_LENGTH) : serialized_result,
            result_truncated: truncated
          }

          @tool_call_trail << entry

          add_step(
            kind: name,
            label: step_label(name, arguments),
            detail: entry[:result],
          )

          entry
        end

        def add_step(kind:, label:, detail: nil)
          step = {
            kind: kind,
            label: label.to_s.truncate(160)
          }
          step[:result] = detail if detail.present?
          @steps << step
        end

        def limit_reached?(max)
          @tool_call_count >= max
        end

        def increment_tool_call
          @tool_call_count += 1
        end

        def searched?
          @searched
        end

        def add_reasoning(thought)
          @reasoning_notes << thought.to_s.truncate(500)
        end

        private

        def step_label(name, arguments)
          args = normalize_arguments(arguments)

          case name
          when "search_transactions"
            "Searching: #{args['query'] || args[:query]}"
          when "query_financial_data"
            "Querying #{args['query_type'] || args[:query_type]} (#{args['period'] || args[:period]})"
          when "fetch_transaction"
            "Reading transaction #{args['transaction_id'] || args[:transaction_id]}"
          when "list_accounts"
            "Listing accounts"
          when "note"
            (args["thought"] || args[:thought]).to_s.truncate(140)
          else
            name
          end
        end

        def normalize_arguments(arguments)
          return {} if arguments.blank?

          arguments.to_h.transform_keys(&:to_s)
        end

        def serialize_result(result)
          case result
          when String
            result
          when Hash, Array
            result.to_json
          else
            result.to_s
          end
        end
      end
    end
  end
end
