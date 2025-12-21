# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::AiChatJob, type: :job do
  let(:session_id) { "test_session_123" }
  let(:query) { "What are my expenses this month?" }
  let(:space_id) { 1 }
  let(:user_id) { 1 }
  let(:job) { described_class.new }

  before do
    allow(Rails.logger).to receive(:info)
    allow(Rails.logger).to receive(:warn)
    allow(Rails.logger).to receive(:error)
    allow(Rails.logger).to receive(:debug)
    allow(ActionCable.server).to receive(:broadcast)
  end

  describe "#perform" do
    context "when conversation_id is provided" do
      let(:conversation_id) { 123 }
      let(:conversation) { instance_double(Ai::Conversation) }
      let(:rag_data) do
        {
          enhanced_prompt: "Enhanced prompt with context",
          raw_ai_analysis: "AI analysis of the query",
          structured_data: {
            metadata: { total_records: 5 },
            query_type: "expense_analysis",
            data_summary: "5 transactions found"
          },
          search_results: {
            results: [
              {
                id: "result_1",
                similarity_score: 0.95,
                content: "Transaction content here...",
                embeddable_type: "Transactions::Expense"
              }
            ]
          },
          data_requirements: {
            query_type: "expense_analysis",
            data_sources: ["transactions"],
            time_range: "current_month",
            filters: { category: "food" }
          }
        }
      end
      let(:mock_rag_operation) { instance_double(Ai::Operations::Rag::ProcessStreamingRagQuery) }
      let(:mock_interaction) { instance_double(Ai::Interaction) }

      before do
        allow(Ai::Operations::Rag::ProcessStreamingRagQuery).to receive(:new).and_return(mock_rag_operation)
        allow(mock_rag_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(rag_data))
        allow(Ai::Interaction).to receive(:create_from_chat_session).and_return(mock_interaction)
        allow(Ai::Conversation).to receive(:find).with(conversation_id).and_return(conversation)
        allow(conversation).to receive(:openai_conversation_id).and_return("openai_conv_123")
        allow(conversation).to receive(:add_assistant_message)
        allow(job).to receive(:stream_llm_response).and_return("AI response content")
        allow(mock_interaction).to receive(:update_with_response)
      end

      it "finds the conversation when conversation_id is present" do
        expect(Ai::Conversation).to receive(:find).with(conversation_id)

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "passes openai_conversation_id to RAG operation" do
        expect(mock_rag_operation).to receive(:call).with(
          query: query,
          space_id: space_id,
          openai_conversation_id: "openai_conv_123"
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "saves assistant message to conversation" do
        expect(conversation).to receive(:add_assistant_message).with(
          "AI response content",
          hash_including(query: query)
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "handles conversation save errors gracefully" do
        allow(conversation).to receive(:add_assistant_message).and_raise(StandardError.new("Database error"))

        expect(Rails.logger).to receive(:warn).with(
          "[AI_CHAT_JOB] Could not save to conversation: Database error"
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "continues processing even if conversation save fails" do
        allow(conversation).to receive(:add_assistant_message).and_raise(StandardError.new("Database error"))
        allow(Rails.logger).to receive(:warn)

        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including("status" => "complete")
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end
    end

    context "when conversation_id is not provided" do
      let(:rag_data) do
        {
          enhanced_prompt: "Enhanced prompt with context",
          raw_ai_analysis: "AI analysis of the query",
          structured_data: {
            metadata: { total_records: 5 },
            query_type: "expense_analysis",
            data_summary: "5 transactions found"
          },
          search_results: {
            results: [
              {
                id: "result_1",
                similarity_score: 0.95,
                content: "Transaction content here...",
                embeddable_type: "Transactions::Expense"
              }
            ]
          },
          data_requirements: {
            query_type: "expense_analysis",
            data_sources: ["transactions"],
            time_range: "current_month",
            filters: { category: "food" }
          }
        }
      end
      let(:mock_rag_operation) { instance_double(Ai::Operations::Rag::ProcessStreamingRagQuery) }
      let(:mock_interaction) { instance_double(Ai::Interaction) }

      before do
        allow(Ai::Operations::Rag::ProcessStreamingRagQuery).to receive(:new).and_return(mock_rag_operation)
        allow(mock_rag_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(rag_data))
        allow(Ai::Interaction).to receive(:create_from_chat_session).and_return(mock_interaction)
        allow(job).to receive(:stream_llm_response).and_return("AI response content")
        allow(mock_interaction).to receive(:update_with_response)
      end

      it "does not attempt to find or save to conversation" do
        expect(Ai::Conversation).not_to receive(:find)

        job.perform(session_id, query, space_id, user_id)
      end

      it "logs warning when broadcasting without conversation_id" do
        expect(Rails.logger).to receive(:warn).with(
          "[AI_CHAT_JOB] Skipping broadcast: conversation_id is nil or empty"
        )

        job.perform(session_id, query, space_id, user_id)
      end
    end

    context "when RAG query is successful" do
      let(:conversation_id) { 123 }
      let(:conversation) { instance_double(Ai::Conversation) }
      let(:rag_data) do
        {
          enhanced_prompt: "Enhanced prompt with context",
          raw_ai_analysis: "AI analysis of the query",
          structured_data: {
            metadata: { total_records: 5 },
            query_type: "expense_analysis",
            data_summary: "5 transactions found"
          },
          search_results: {
            results: [
              {
                id: "result_1",
                similarity_score: 0.95,
                content: "Transaction content here...",
                embeddable_type: "Transactions::Expense"
              }
            ]
          },
          data_requirements: {
            query_type: "expense_analysis",
            data_sources: ["transactions"],
            time_range: "current_month",
            filters: { category: "food" }
          }
        }
      end

      let(:mock_rag_operation) { instance_double(Ai::Operations::Rag::ProcessStreamingRagQuery) }
      let(:mock_interaction) { instance_double(Ai::Interaction) }

      before do
        allow(Ai::Operations::Rag::ProcessStreamingRagQuery).to receive(:new).and_return(mock_rag_operation)
        allow(mock_rag_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(rag_data))
        allow(Ai::Interaction).to receive(:create_from_chat_session).and_return(mock_interaction)
        allow(Ai::Conversation).to receive(:find).with(conversation_id).and_return(conversation)
        allow(conversation).to receive(:openai_conversation_id).and_return(nil)
        allow(conversation).to receive(:add_assistant_message)
        allow(job).to receive(:stream_llm_response).and_return("AI response content")
        allow(mock_interaction).to receive(:update_with_response)
      end

      it "processes the RAG query successfully" do
        expect(mock_rag_operation).to receive(:call).with(
          query: query,
          space_id: space_id,
          openai_conversation_id: nil
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "creates an interaction record" do
        expect(Ai::Interaction).to receive(:create_from_chat_session).with(
          session_id, user_id, space_id, query
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "broadcasts metadata and raw AI analysis" do
        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including(
            "status" => "processing",
            "metadata" => hash_including(
              "query" => query,
              "confidence" => be_a(Numeric),
              "sources" => be_an(Array)
            ),
            "raw_ai_analysis" => "AI analysis of the query"
          )
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "streams LLM response" do
        expect(job).to receive(:stream_llm_response).with(
          "Enhanced prompt with context",
          nil,
          conversation_id: conversation_id,
          user_query: query
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "updates interaction with response data" do
        expect(mock_interaction).to receive(:update_with_response).with(
          "AI response content",
          be_a(Numeric), # token count
          be_a(Numeric), # time in seconds
          hash_including(query: query),
          "Enhanced prompt with context"
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "broadcasts completion status" do
        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including(
            "status" => "complete",
            "content" => "AI response content"
          )
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end
    end

    context "when RAG query fails" do
      let(:conversation_id) { 123 }
      let(:conversation) { instance_double(Ai::Conversation) }
      let(:error_message) { "RAG query failed" }
      let(:mock_rag_operation) { instance_double(Ai::Operations::Rag::ProcessStreamingRagQuery) }
      let(:mock_interaction) { instance_double(Ai::Interaction) }

      before do
        allow(Ai::Operations::Rag::ProcessStreamingRagQuery).to receive(:new).and_return(mock_rag_operation)
        allow(mock_rag_operation).to receive(:call).and_return(Dry::Monads::Result::Failure.new(error_message))
        allow(Ai::Interaction).to receive(:create_from_chat_session).and_return(mock_interaction)
        allow(Ai::Conversation).to receive(:find).with(conversation_id).and_return(conversation)
        allow(conversation).to receive(:openai_conversation_id).and_return(nil)
        allow(mock_interaction).to receive(:update_with_error)
      end

      it "updates interaction with error" do
        expect(mock_interaction).to receive(:update_with_error).with(error_message)

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "broadcasts error status" do
        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including(
            "status" => "error",
            "error" => error_message
          )
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "does not continue processing" do
        expect(job).not_to receive(:stream_llm_response)

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end
    end

    context "when interaction creation fails" do
      let(:conversation_id) { 123 }
      let(:conversation) { instance_double(Ai::Conversation) }
      let(:rag_data) do
        {
          enhanced_prompt: "test",
          raw_ai_analysis: "test",
          structured_data: {
            metadata: { total_records: 0 },
            query_type: "test",
            data_summary: "test"
          },
          search_results: { results: [] },
          data_requirements: {
            query_type: "test",
            data_sources: [],
            time_range: "test",
            filters: {}
          }
        }
      end
      let(:mock_rag_operation) { instance_double(Ai::Operations::Rag::ProcessStreamingRagQuery) }

      before do
        allow(Ai::Operations::Rag::ProcessStreamingRagQuery).to receive(:new).and_return(mock_rag_operation)
        allow(mock_rag_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(rag_data))
        allow(Ai::Interaction).to receive(:create_from_chat_session).and_raise(StandardError.new("Database error"))
        allow(Ai::Conversation).to receive(:find).with(conversation_id).and_return(conversation)
        allow(conversation).to receive(:openai_conversation_id).and_return(nil)
        allow(conversation).to receive(:add_assistant_message)
        allow(job).to receive(:stream_llm_response).and_return("AI response")
      end

      it "logs warning and continues processing" do
        expect(Rails.logger).to receive(:warn).with(
          "[AI_CHAT_JOB] Could not create interaction record: Database error"
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "continues with RAG processing" do
        expect(mock_rag_operation).to receive(:call)

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end
    end

    context "when LLM streaming fails" do
      let(:conversation_id) { 123 }
      let(:conversation) { instance_double(Ai::Conversation) }
      let(:rag_data) do
        {
          enhanced_prompt: "test",
          raw_ai_analysis: "test",
          structured_data: {
            metadata: { total_records: 0 },
            query_type: "test",
            data_summary: "test"
          },
          search_results: { results: [] },
          data_requirements: {
            query_type: "test",
            data_sources: [],
            time_range: "test",
            filters: {}
          }
        }
      end
      let(:mock_rag_operation) { instance_double(Ai::Operations::Rag::ProcessStreamingRagQuery) }
      let(:mock_interaction) { instance_double(Ai::Interaction) }

      before do
        allow(Ai::Operations::Rag::ProcessStreamingRagQuery).to receive(:new).and_return(mock_rag_operation)
        allow(mock_rag_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(rag_data))
        allow(Ai::Interaction).to receive(:create_from_chat_session).and_return(mock_interaction)
        allow(Ai::Conversation).to receive(:find).with(conversation_id).and_return(conversation)
        allow(conversation).to receive(:openai_conversation_id).and_return(nil)
        allow(mock_interaction).to receive(:update_with_error)
        allow(job).to receive(:stream_llm_response).and_raise(StandardError.new("LLM error"))
      end

      it "logs error and updates interaction" do
        expect(Rails.logger).to receive(:error).with(
          "[AI_CHAT_JOB] Error: LLM error"
        )
        expect(mock_interaction).to receive(:update_with_error).with("LLM error")

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end

      it "broadcasts error status" do
        allow(Rails.logger).to receive(:error)
        allow(mock_interaction).to receive(:update_with_error)

        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including(
            "status" => "error",
            "error" => "LLM error"
          )
        )

        job.perform(session_id, query, space_id, user_id, conversation_id)
      end
    end
  end

  describe "#broadcast_chat_update" do
    let(:conversation_id) { 123 }
    let(:data) { { status: "processing", content: "test" } }

    context "when conversation_id is present" do
      it "broadcasts to the correct channel" do
        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including("status" => "processing", "content" => "test")
        )

        job.send(:broadcast_chat_update, conversation_id, data)
      end

      it "converts symbols to strings" do
        expect(ActionCable.server).to receive(:broadcast) do |channel, broadcast_data|
          expect(broadcast_data).to be_a(Hash)
          expect(broadcast_data.keys.all? { |k| k.is_a?(String) }).to be true
        end

        job.send(:broadcast_chat_update, conversation_id, { status: :processing })
      end

      it "handles broadcast errors gracefully" do
        allow(ActionCable.server).to receive(:broadcast).and_raise(StandardError.new("Broadcast failed"))

        expect(Rails.logger).to receive(:error).with(
          "[AI_CHAT_JOB] Broadcast failed: Broadcast failed"
        )

        job.send(:broadcast_chat_update, conversation_id, data)
      end

      it "logs backtrace on broadcast error" do
        error = StandardError.new("Broadcast failed")
        allow(ActionCable.server).to receive(:broadcast).and_raise(error)
        allow(Rails.logger).to receive(:error)

        expect(Rails.logger).to receive(:error).with(be_a(String))

        job.send(:broadcast_chat_update, conversation_id, data)
      end
    end

    context "when conversation_id is nil" do
      it "logs warning and does not broadcast" do
        expect(Rails.logger).to receive(:warn).with(
          "[AI_CHAT_JOB] Skipping broadcast: conversation_id is nil or empty"
        )
        expect(ActionCable.server).not_to receive(:broadcast)

        job.send(:broadcast_chat_update, nil, data)
      end
    end

    context "when conversation_id is empty string" do
      it "logs warning and does not broadcast" do
        expect(Rails.logger).to receive(:warn).with(
          "[AI_CHAT_JOB] Skipping broadcast: conversation_id is nil or empty"
        )
        expect(ActionCable.server).not_to receive(:broadcast)

        job.send(:broadcast_chat_update, "", data)
      end
    end
  end

  describe "#calculate_metadata" do
    let(:rag_data) do
      {
        structured_data: {
          metadata: { total_records: 5 },
          query_type: "expense_analysis",
          data_summary: "5 transactions found"
        },
        search_results: {
          results: [
            {
              id: "result_1",
              similarity_score: 0.95,
              content: "Transaction content here...",
              embeddable_type: "Transactions::Expense"
            }
          ]
        },
        data_requirements: {
          query_type: "expense_analysis",
          data_sources: ["transactions"],
          time_range: "current_month",
          filters: { category: "food" }
        }
      }
    end

    it "calculates confidence based on structured data" do
      metadata = job.send(:calculate_metadata, rag_data, query)

      expect(metadata[:confidence]).to eq(1.0)
    end

    it "calculates lower confidence when no structured data" do
      rag_data_no_records = rag_data.dup
      rag_data_no_records[:structured_data][:metadata][:total_records] = 0

      metadata = job.send(:calculate_metadata, rag_data_no_records, query)

      expect(metadata[:confidence]).to be >= 0.3
      expect(metadata[:confidence]).to be <= 1.0
    end

    it "includes structured data source when records exist" do
      metadata = job.send(:calculate_metadata, rag_data, query)

      expect(metadata[:sources]).to include(
        hash_including(
          id: "structured_data",
          type: "structured_query",
          similarity: 1.0
        )
      )
    end

    it "does not include structured data source when no records" do
      rag_data_no_records = rag_data.dup
      rag_data_no_records[:structured_data][:metadata][:total_records] = 0

      metadata = job.send(:calculate_metadata, rag_data_no_records, query)

      expect(metadata[:sources]).not_to include(
        hash_including(id: "structured_data")
      )
    end

    it "includes vector search sources" do
      metadata = job.send(:calculate_metadata, rag_data, query)

      expect(metadata[:sources]).to include(
        hash_including(
          id: "result_1",
          type: "Transactions::Expense",
          similarity: 0.95
        )
      )
    end

    it "truncates content in sources to 100 characters" do
      long_content = "a" * 150
      rag_data_long = rag_data.dup
      rag_data_long[:search_results][:results][0][:content] = long_content

      metadata = job.send(:calculate_metadata, rag_data_long, query)

      source = metadata[:sources].find { |s| s[:id] == "result_1" }
      expect(source[:content].length).to eq(104) # 101 chars (0..100) + "..."
    end

    it "includes AI analysis metadata" do
      metadata = job.send(:calculate_metadata, rag_data, query)

      expect(metadata[:ai_analysis]).to eq({
        query_type: "expense_analysis",
        data_sources: ["transactions"],
        time_range: "current_month",
        filters: { category: "food" }
      })
    end

    it "includes the query in metadata" do
      metadata = job.send(:calculate_metadata, rag_data, query)

      expect(metadata[:query]).to eq(query)
    end
  end

  describe "#calculate_tokens" do
    it "estimates tokens based on content length" do
      content = "This is a test content with 40 characters"
      tokens = job.send(:calculate_tokens, content)

      expect(tokens).to eq(11) # 41 / 4 = 10.25, rounded up to 11
    end

    it "rounds up for partial tokens" do
      content = "123" # 3 characters
      tokens = job.send(:calculate_tokens, content)

      expect(tokens).to eq(1) # 3 / 4 = 0.75, rounded up to 1
    end

    it "handles empty content" do
      content = ""
      tokens = job.send(:calculate_tokens, content)

      expect(tokens).to eq(0)
    end
  end

  describe "#stream_llm_response" do
    let(:conversation_id) { 123 }
    let(:enhanced_prompt) { "Enhanced prompt" }
    let(:openai_conversation_id) { "openai_conv_123" }
    let(:user_query) { "What are my expenses?" }
    let(:mock_client) { instance_double(OpenAI::Client) }
    let(:mock_responses) { instance_double(OpenAI::Responses) }

    before do
      allow(OpenAI::Client).to receive(:new).and_return(mock_client)
      allow(mock_client).to receive(:responses).and_return(mock_responses)
      allow(ActionCable.server).to receive(:broadcast)
    end

    context "when streaming is successful" do
      it "creates OpenAI client with API key" do
        allow(ENV).to receive(:[]).with("OPENAI_API_KEY").and_return("test_key")
        allow(mock_responses).to receive(:create) do |params|
          params[:parameters][:stream].call({ "delta" => "Hello" }, "chunk")
        end.and_return({})

        job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)

        expect(OpenAI::Client).to have_received(:new).with(access_token: "test_key")
      end

      it "calls responses.create with correct parameters" do
        allow(mock_responses).to receive(:create) do |params|
          expect(params[:parameters][:model]).to eq("gpt-3.5-turbo")
          expect(params[:parameters][:conversation][:id]).to eq(openai_conversation_id)
          expect(params[:parameters][:input]).to eq(user_query)
          expect(params[:parameters][:instructions]).to eq(enhanced_prompt)
          expect(params[:parameters][:temperature]).to eq(0.3)
          expect(params[:parameters][:max_output_tokens]).to eq(2000)
          params[:parameters][:stream].call({ "delta" => "Hello" }, "chunk")
        end.and_return({})

        job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)
      end

      it "accumulates content from delta chunks" do
        chunks = [
          { "delta" => "Hello" },
          { "delta" => " world" }
        ]
        allow(mock_responses).to receive(:create) do |params|
          chunks.each { |chunk| params[:parameters][:stream].call(chunk, "chunk") }
        end.and_return({})

        result = job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)

        expect(result).to eq("Hello world")
      end

      it "broadcasts streaming updates" do
        chunks = [
          { "delta" => "Hello" },
          { "delta" => " world" }
        ]
        allow(mock_responses).to receive(:create) do |params|
          chunks.each { |chunk| params[:parameters][:stream].call(chunk, "chunk") }
        end.and_return({})

        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including("status" => "streaming", "content" => "Hello")
        )
        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including("status" => "streaming", "content" => "Hello world")
        )

        job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)
      end

      it "handles chunks with choices path" do
        chunk = { "choices" => [{ "delta" => { "content" => "Hello" } }] }
        allow(mock_responses).to receive(:create) do |params|
          params[:parameters][:stream].call(chunk, "chunk")
        end.and_return({})

        result = job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)

        expect(result).to eq("Hello")
      end

      it "handles chunks with output path" do
        chunk = { "output" => [{ "content" => [{ "text" => "Hello" }] }] }
        allow(mock_responses).to receive(:create) do |params|
          params[:parameters][:stream].call(chunk, "chunk")
        end.and_return({})

        result = job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)

        expect(result).to eq("Hello")
      end

      it "ignores non-content chunks" do
        chunk = { "type" => "response.in_progress" }
        allow(mock_responses).to receive(:create) do |params|
          params[:parameters][:stream].call(chunk, "chunk")
        end.and_return({})

        expect(Rails.logger).not_to receive(:debug)

        job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)
      end

      it "logs debug for non-content chunks that are not in_progress" do
        chunk = { "type" => "other_type" }
        allow(mock_responses).to receive(:create) do |params|
          params[:parameters][:stream].call(chunk, "chunk")
        end.and_return({})

        expect(Rails.logger).to receive(:debug).with(
          "[AI_CHAT_JOB] ℹ️ Non-content chunk: other_type"
        )

        job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)
      end
    end

    context "when error events occur" do
      it "handles error event and broadcasts error" do
        error_chunk = { "type" => "error", "error" => { "message" => "API error", "code" => "rate_limit" } }
        allow(mock_responses).to receive(:create) do |params|
          params[:parameters][:stream].call(error_chunk, "error")
        end.and_return({})

        expect(Rails.logger).to receive(:error).with(
          "[AI_CHAT_JOB] OpenAI API Error: rate_limit - API error"
        )
        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including(
            "status" => "error",
            "error" => "AI service error: API error",
            "error_code" => "rate_limit"
          )
        )

        job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)
      end

      it "handles response.failed event" do
        failed_chunk = { "type" => "response.failed", "response" => { "error" => { "message" => "Response failed", "code" => "timeout" } } }
        allow(mock_responses).to receive(:create) do |params|
          params[:parameters][:stream].call(failed_chunk, "response.failed")
        end.and_return({})

        expect(Rails.logger).to receive(:error).with(
          "[AI_CHAT_JOB] Response Failed: timeout - Response failed"
        )
        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including(
            "status" => "error",
            "error" => "AI service error: Response failed",
            "error_code" => "timeout"
          )
        )

        job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)
      end
    end

    context "when no content is accumulated" do
      it "broadcasts error when no content received" do
        allow(mock_responses).to receive(:create).and_return({})

        expect(Rails.logger).to receive(:error).with(
          "[AI_CHAT_JOB] No content received from AI service"
        )
        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including(
            "status" => "error",
            "error" => include("did not return any content")
          )
        )

        job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)
      end

      it "tries to extract content from response hash" do
        response = { "output" => [{ "content" => [{ "text" => "Fallback content" }] }] }
        allow(mock_responses).to receive(:create).and_return(response)

        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including("status" => "streaming", "content" => "Fallback content")
        )

        result = job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)

        expect(result).to eq("Fallback content")
      end

      it "tries choices path in response hash" do
        response = { "choices" => [{ "message" => { "content" => "Choices content" } }] }
        allow(mock_responses).to receive(:create).and_return(response)

        result = job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)

        expect(result).to eq("Choices content")
      end

      it "tries content key in response hash" do
        response = { "content" => "Direct content" }
        allow(mock_responses).to receive(:create).and_return(response)

        result = job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)

        expect(result).to eq("Direct content")
      end
    end

    context "when streaming raises an error" do
      it "logs error and re-raises" do
        allow(mock_responses).to receive(:create).and_raise(StandardError.new("Streaming error"))

        expect(Rails.logger).to receive(:error).with(
          "[AI_CHAT_JOB] Error during streaming: StandardError: Streaming error"
        )

        expect {
          job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)
        }.to raise_error(StandardError, "Streaming error")
      end

      it "broadcasts error and re-raises on StandardError" do
        allow(mock_responses).to receive(:create).and_raise(StandardError.new("LLM error"))

        expect(ActionCable.server).to receive(:broadcast).with(
          "chat_#{conversation_id}",
          hash_including(
            "status" => "error",
            "error" => "Failed to stream LLM response: LLM error"
          )
        )

        expect {
          job.send(:stream_llm_response, enhanced_prompt, openai_conversation_id, conversation_id: conversation_id, user_query: user_query)
        }.to raise_error(StandardError, "LLM error")
      end
    end
  end
end
