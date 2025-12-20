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
    allow(Rails.cache).to receive(:read).and_return({})
    allow(Rails.cache).to receive(:write)
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
        allow(conversation).to receive(:openai_conversation_id).and_return(nil)
        allow(conversation).to receive(:add_assistant_message)
        allow(job).to receive(:stream_llm_response_to_cache).and_return("AI response content")
        allow(mock_interaction).to receive(:update_with_response)
      end

      it "finds the conversation when conversation_id is present" do
        expect(Ai::Conversation).to receive(:find).with(conversation_id)

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

        expect(Rails.cache).to receive(:write).with(
          "ai_chat_#{session_id}",
          hash_including(status: "complete"),
          expires_in: 10.minutes
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
        allow(job).to receive(:stream_llm_response_to_cache).and_return("AI response content")
        allow(mock_interaction).to receive(:update_with_response)
      end

      it "does not attempt to find conversation" do
        expect(Ai::Conversation).not_to receive(:find)

        job.perform(session_id, query, space_id, user_id)
      end

      it "does not save to conversation" do
        expect_any_instance_of(Ai::Conversation).not_to receive(:add_assistant_message)

        job.perform(session_id, query, space_id, user_id)
      end
    end

    context "when RAG query is successful" do
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
      let(:mock_openai_client) { instance_double(OpenAI::Client) }

      before do
        allow(Ai::Operations::Rag::ProcessStreamingRagQuery).to receive(:new).and_return(mock_rag_operation)
        allow(mock_rag_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(rag_data))
        allow(Ai::Interaction).to receive(:create_from_chat_session).and_return(mock_interaction)
        allow(OpenAI::Client).to receive(:new).and_return(mock_openai_client)
        allow(mock_openai_client).to receive(:chat)
        allow(job).to receive(:stream_llm_response_to_cache).and_return("AI response content")
        allow(mock_interaction).to receive(:update_with_response)
      end

      it "processes the RAG query successfully" do
        expect(mock_rag_operation).to receive(:call).with(
          query: query,
          space_id: space_id,
          openai_conversation_id: nil
        )

        job.perform(session_id, query, space_id, user_id)
      end

      it "creates an interaction record" do
        expect(Ai::Interaction).to receive(:create_from_chat_session).with(
          session_id, user_id, space_id, query
        )

        job.perform(session_id, query, space_id, user_id)
      end

      it "updates cache with metadata and raw AI analysis" do
        expect(Rails.cache).to receive(:write).with(
          "ai_chat_#{session_id}",
          hash_including(
            metadata: hash_including(
              query: query,
              confidence: be_a(Numeric),
              sources: be_an(Array)
            ),
            raw_ai_analysis: "AI analysis of the query"
          ),
          expires_in: 10.minutes
        )

        job.perform(session_id, query, space_id, user_id)
      end

      it "streams LLM response to cache" do
        expect(job).to receive(:stream_llm_response_to_cache).with(
          session_id,
          "Enhanced prompt with context",
          nil,
          user_query: query
        )

        job.perform(session_id, query, space_id, user_id)
      end

      it "updates interaction with response data" do
        expect(mock_interaction).to receive(:update_with_response).with(
          "AI response content",
          be_a(Numeric), # token count
          be_a(Numeric), # time in seconds
          hash_including(query: query),
          "Enhanced prompt with context"
        )

        job.perform(session_id, query, space_id, user_id)
      end

      it "marks job as complete in cache" do
        expect(Rails.cache).to receive(:write).with(
          "ai_chat_#{session_id}",
          hash_including(status: "complete"),
          expires_in: 10.minutes
        )

        job.perform(session_id, query, space_id, user_id)
      end
    end

    context "when RAG query fails" do
      let(:error_message) { "RAG query failed" }
      let(:mock_rag_operation) { instance_double(Ai::Operations::Rag::ProcessStreamingRagQuery) }
      let(:mock_interaction) { instance_double(Ai::Interaction) }

      before do
        allow(Ai::Operations::Rag::ProcessStreamingRagQuery).to receive(:new).and_return(mock_rag_operation)
        allow(mock_rag_operation).to receive(:call).and_return(Dry::Monads::Result::Failure.new(error_message))
        allow(Ai::Interaction).to receive(:create_from_chat_session).and_return(mock_interaction)
        allow(mock_interaction).to receive(:update_with_error)
      end

      it "updates interaction with error" do
        expect(mock_interaction).to receive(:update_with_error).with(error_message)

        job.perform(session_id, query, space_id, user_id)
      end

      it "updates cache with error status" do
        expect(Rails.cache).to receive(:write).with(
          "ai_chat_#{session_id}",
          hash_including(
            status: "error",
            error: error_message
          ),
          expires_in: 10.minutes
        )

        job.perform(session_id, query, space_id, user_id)
      end

      it "does not continue processing" do
        expect(job).not_to receive(:stream_llm_response_to_cache)

        job.perform(session_id, query, space_id, user_id)
      end
    end

    context "when interaction creation fails" do
      let(:rag_data) { { enhanced_prompt: "test", raw_ai_analysis: "test" } }
      let(:mock_rag_operation) { instance_double(Ai::Operations::Rag::ProcessStreamingRagQuery) }

      before do
        allow(Ai::Operations::Rag::ProcessStreamingRagQuery).to receive(:new).and_return(mock_rag_operation)
        allow(mock_rag_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(rag_data))
        allow(Ai::Interaction).to receive(:create_from_chat_session).and_raise(StandardError.new("Database error"))
        allow(job).to receive(:stream_llm_response_to_cache).and_return("AI response")
      end

      it "logs warning and continues processing" do
        expect(Rails.logger).to receive(:warn).with(
          "[AI_CHAT_JOB] Could not create interaction record: Database error"
        )

        job.perform(session_id, query, space_id, user_id)
      end

      it "continues with RAG processing" do
        expect(mock_rag_operation).to receive(:call)

        job.perform(session_id, query, space_id, user_id)
      end
    end

    context "when LLM streaming fails" do
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
        allow(mock_interaction).to receive(:update_with_error)
        allow(job).to receive(:stream_llm_response_to_cache).and_raise(StandardError.new("LLM error"))
      end

      it "logs error and updates interaction" do
        expect(Rails.logger).to receive(:error).with(
          "[AI_CHAT_JOB] Error: LLM error"
        )
        expect(mock_interaction).to receive(:update_with_error).with("LLM error")

        job.perform(session_id, query, space_id, user_id)
      end

      it "updates cache with error status" do
        allow(Rails.logger).to receive(:error)
        allow(mock_interaction).to receive(:update_with_error)

        expect(Rails.cache).to receive(:write).with(
          "ai_chat_#{session_id}",
          hash_including(
            status: "error",
            error: "LLM error"
          ),
          expires_in: 10.minutes
        )

        job.perform(session_id, query, space_id, user_id)
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

    it "includes AI analysis metadata" do
      metadata = job.send(:calculate_metadata, rag_data, query)

      expect(metadata[:ai_analysis]).to eq({
        query_type: "expense_analysis",
        data_sources: ["transactions"],
        time_range: "current_month",
        filters: { category: "food" }
      })
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
  end

  describe "#update_chat_cache" do
    it "merges updates with existing cache data" do
      existing_data = { status: "processing", content: "partial" }
      allow(Rails.cache).to receive(:read).and_return(existing_data)

      job.send(:update_chat_cache, session_id, { status: "complete" })

      expect(Rails.cache).to have_received(:write).with(
        "ai_chat_#{session_id}",
        { status: "complete", content: "partial" },
        expires_in: 10.minutes
      )
    end

    it "creates new cache entry when none exists" do
      allow(Rails.cache).to receive(:read).and_return(nil)

      job.send(:update_chat_cache, session_id, { status: "new" })

      expect(Rails.cache).to have_received(:write).with(
        "ai_chat_#{session_id}",
        { status: "new" },
        expires_in: 10.minutes
      )
    end
  end
end
