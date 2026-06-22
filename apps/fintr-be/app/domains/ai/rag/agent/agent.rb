# frozen_string_literal: true

module Ai
  module Rag
    module Agent
      class Agent
        def run(
          conversation_id:,
          space_id:,
          user_query:,
          on_content:,
          on_step:
        )
          collector = RetrievalCollector.new
          tools = build_tools(
            space_id: space_id,
            collector: collector,
          )

          query = user_query.to_s.strip
          if query.blank?
            return empty_result(collector, content: "I didn't receive a question to answer.")
          end

          accumulated = run_turn(
            conversation_id: conversation_id,
            user_query: query,
            tools: tools,
            collector: collector,
            on_content: on_content,
            on_step: on_step,
            seed_history: true,
          )

          unless collector.searched?
            Rails.logger.info "[AI_AGENT] Retrying without conversation history (no tools on first pass)"

            accumulated = run_turn(
              conversation_id: conversation_id,
              user_query: query,
              tools: tools,
              collector: collector,
              on_content: on_content,
              on_step: on_step,
              seed_history: false,
            )
          end

          result = {
            content: accumulated,
            cited_embedding_ids: collector.cited_embedding_ids,
            steps: collector.steps,
            tool_calls: collector.tool_call_trail,
            reasoning_notes: collector.reasoning_notes,
            searched: collector.searched?,
            agentic: true,
            model: Rails.configuration.x.llm.agent_model,
            provider: Rails.configuration.x.llm.agent_provider
          }

          result[:content] = ResponseFallbackBuilder.build(result)

          if result[:content].present? && result[:content] != accumulated
            on_content.call(result[:content])
          end

          result
        end

        private

        def run_turn(
          conversation_id:,
          user_query:,
          tools:,
          collector:,
          on_content:,
          on_step:,
          seed_history:
        )
          chat_builder = ChatBuilder.new(
            conversation_id: conversation_id,
            user_query: user_query,
            seed_history: seed_history,
          )
          llm = chat_builder.build
          query = chat_builder.pending_user_query.presence || user_query

          llm.with_instructions(AgentPromptBuilder.build, replace: true)
          llm.with_tools(*tools, replace: true)
          llm.on_tool_call do |tool_call|
            on_step.call(step_for(tool_call))
          end

          accumulated = +""
          llm.ask(query) do |chunk|
            next unless chunk.respond_to?(:content) && chunk.content.present?

            accumulated << chunk.content
            on_content.call(accumulated)
          end

          accumulated
        end

        def build_tools(
          space_id:,
          collector:
        )
          [
            Tools::SearchTransactions.new(
              space_id: space_id,
              collector: collector,
            ),
            Tools::QueryFinancialData.new(
              space_id: space_id,
              collector: collector,
            ),
            Tools::FetchTransaction.new(
              space_id: space_id,
              collector: collector,
            ),
            Tools::ListAccounts.new(
              space_id: space_id,
              collector: collector,
            ),
            Tools::Note.new(collector: collector)
          ]
        end

        def empty_result(collector, content:)
          {
            content: content,
            cited_embedding_ids: collector.cited_embedding_ids,
            steps: collector.steps,
            tool_calls: collector.tool_call_trail,
            reasoning_notes: collector.reasoning_notes,
            searched: collector.searched?,
            agentic: true,
            model: Rails.configuration.x.llm.agent_model,
            provider: Rails.configuration.x.llm.agent_provider
          }
        end

        def step_for(tool_call)
          label = case tool_call.name
          when "search_transactions"
            "Searching: #{tool_call.arguments['query'] || tool_call.arguments[:query]}"
          when "query_financial_data"
            query_type = tool_call.arguments["query_type"] || tool_call.arguments[:query_type]
            period = tool_call.arguments["period"] || tool_call.arguments[:period]
            "Querying #{query_type} (#{period})"
          when "fetch_transaction"
            "Reading transaction details"
          when "list_accounts"
            "Listing accounts"
          when "note"
            thought = tool_call.arguments["thought"] || tool_call.arguments[:thought]
            thought.to_s.truncate(140)
          else
            tool_call.name
          end

          {
            kind: tool_call.name,
            label: label
          }
        end
      end
    end
  end
end
