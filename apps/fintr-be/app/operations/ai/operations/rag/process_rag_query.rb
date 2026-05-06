# frozen_string_literal: true

module Ai
  module Operations
    module Rag
      # Orchestrates the RAG flow using Dry::Operation
      class ProcessRagQuery < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:query).value(:string)
            required(:space_id).value(:string)
            optional(:conversation_id).maybe(:string)
          end
        end

        def initialize(
          analyzer: nil,
          retriever: nil,
          searcher: nil,
          prompt_builder: nil
        )
          super()
          @analyzer = analyzer || Ai::Rag::QueryAnalyzer.new
          @retriever = retriever || Ai::Rag::DataRetriever.new
          @searcher = searcher || Ai::Rag::VectorSearcher.new
          @prompt_builder = prompt_builder || Ai::Prompts::Builders::RagPromptBuilder.new
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)

          analysis = step analyze_query(params:)
          structured_data = step retrieve_data(params:, analysis:)
          vector_results = step search_vectors(params:, analysis:)
          prompt = step build_prompt(
            params:,
            analysis:,
            structured_data:,
            vector_results:
          )

          {
            prompt: prompt,
            analysis: analysis,
            structured_data: structured_data,
            vector_results: vector_results
          }
        end

        private

        def analyze_query(params:)
          context = load_context(params[:conversation_id])

          @analyzer.analyze(
            query: params[:query],
            space_id: params[:space_id],
            conversation_context: context,
          )
        rescue StandardError => e
          Rails.logger.error "[ProcessRagQuery#analyze_query] Error: #{e.message}"
          Failure(analysis_error: e.message)
        end

        def retrieve_data(params:, analysis:)
          @retriever.retrieve(analysis)
        rescue StandardError => e
          Rails.logger.error "[ProcessRagQuery#retrieve_data] Error: #{e.message}"
          Failure(data_retrieval_error: e.message)
        end

        def search_vectors(params:, analysis:)
          @searcher.search(
            query: params[:query],
            space_id: params[:space_id],
            filters: analysis.filters,
          )
        rescue StandardError => e
          Rails.logger.error "[ProcessRagQuery#search_vectors] Error: #{e.message}"
          Failure(vector_search_error: e.message)
        end

        def build_prompt(params:, analysis:, structured_data:, vector_results:)
          @prompt_builder.build(
            query: params[:query],
            analysis: analysis,
            structured_data: structured_data,
            vector_results: vector_results,
            conversation_id: params[:conversation_id],
          )
        rescue StandardError => e
          Rails.logger.error "[ProcessRagQuery#build_prompt] Error: #{e.message}"
          Failure(prompt_building_error: e.message)
        end

        def load_context(conversation_id)
          return nil unless conversation_id.present?

          Ai::Conversations::ContextBuilder
            .new(conversation_id: conversation_id)
            .load_recent_context
        end
      end
    end
  end
end
