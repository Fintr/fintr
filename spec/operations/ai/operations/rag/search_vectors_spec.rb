# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Rag::SearchVectors, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:space_user) { create(:space_user, user: user, space: space) }
  let(:account) { create(:account, space: space) }
  let(:category) { create(:category, space: space) }
  let(:transaction) { create(:expense_transaction, space: space, account: account, category: category) }
  let(:embedding_vector) { Array.new(1536) { rand(-1.0..1.0) } }

  let(:params) do
    {
      query: "Find my grocery expenses",
      space_id: space.id,
      limit: 10,
      threshold: 0.7
    }
  end

  let(:openai_response) do
    {
      "data" => [
        {
          "embedding" => embedding_vector
        }
      ]
    }
  end

  describe "Contract" do
    it "succeeds with valid parameters" do
      result = operation.validate(params: params)
      expect(result).to be_success
    end

    it "succeeds with optional parameters" do
      extended_params = params.merge(
        embeddable_type: "Transactions::Transaction",
        filters: { transaction_type: "Transactions::Expense" }
      )
      result = operation.validate(params: extended_params)
      expect(result).to be_success
    end

    it "fails without query" do
      params.delete(:query)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:query)
    end

    it "fails without space_id" do
      params.delete(:space_id)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails without limit" do
      params.delete(:limit)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:limit)
    end

    it "fails without threshold" do
      params.delete(:threshold)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:threshold)
    end

    it "fails with invalid query type" do
      params[:query] = 123
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:query)
    end

    it "fails with invalid space_id type" do
      params[:space_id] = 123
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails with invalid limit type" do
      params[:limit] = "ten"
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:limit)
    end

    it "fails with invalid threshold type" do
      params[:threshold] = "high"
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:threshold)
    end

    it "fails with invalid embeddable_type type" do
      params[:embeddable_type] = 123
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:embeddable_type)
    end

    it "fails with invalid filters type" do
      params[:filters] = "invalid"
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:filters)
    end
  end

  describe "#call" do
    let(:rag_embedding) do
      embedding = create(:ai_rag_embedding,
                        space: space,
                        embeddable: transaction,
                        content: "Transaction: Grocery purchase",
                        embedding: embedding_vector,
                        metadata: {
                          transaction_type: "Transactions::Expense",
                          category: category.name,
                          account: account.name,
                          date: transaction.date.iso8601
                        })
      # Add neighbor_distance method to the embedding object
      def embedding.neighbor_distance
        0.2
      end
      embedding
    end

    let(:search_results) { [rag_embedding] }

      before do
        # Mock GenerateQueryEmbedding operation
        generate_operation = instance_double(Ai::Operations::Embeddings::GenerateQueryEmbedding)
        allow(Ai::Operations::Embeddings::GenerateQueryEmbedding).to receive(:new).and_return(generate_operation)
        allow(generate_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(embedding_vector))

        # Mock vector search results
        allow(Ai::RagEmbedding).to receive(:nearest_neighbors_optimized).and_return(search_results)
      end

    context "when all steps succeed" do
      it "successfully performs vector search and returns formatted results" do
        result = operation.call(params)
        expect(result).to be_success
        expect(result.value!).to include(
          query: "Find my grocery expenses",
          results: kind_of(Array),
          total_count: 1,
          space_id: space.id
        )
      end

      it "returns properly formatted results" do
        result = operation.call(params)
        formatted_result = result.value![:results].first

        expect(formatted_result).to include(
          id: rag_embedding.id,
          embeddable_id: rag_embedding.embeddable_id,
          embeddable_type: rag_embedding.embeddable_type,
          content: rag_embedding.content,
          metadata: rag_embedding.metadata,
          similarity_score: kind_of(Numeric),
          distance: kind_of(Numeric)
        )
      end

      it "calls GenerateQueryEmbedding operation with correct parameters" do
        generate_operation = instance_double(Ai::Operations::Embeddings::GenerateQueryEmbedding)
        allow(Ai::Operations::Embeddings::GenerateQueryEmbedding).to receive(:new).and_return(generate_operation)
        allow(generate_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(embedding_vector))

        operation.call(params)

        expect(generate_operation).to have_received(:call).with(query: "Find my grocery expenses")
      end
    end

    context "with embeddable_type filter" do
      let(:filtered_params) do
        params.merge(embeddable_type: "Transactions::Transaction")
      end

      it "filters by embeddable type" do
        result = operation.call(filtered_params)
        expect(result).to be_success
      end
    end

    context "with additional filters" do
      let(:filtered_params) do
        params.merge(
          filters: {
            transaction_type: "Transactions::Expense",
            category: "Food",
            account: "Cash"
          }
        )
      end

      it "applies all filters correctly" do
        result = operation.call(filtered_params)
        expect(result).to be_success
      end
    end

    context "when validate fails" do
      let(:invalid_params) { { query: nil, space_id: space.id, limit: 10, threshold: 0.7 } }

      it "returns a failure" do
        result = operation.call(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:query)
      end
    end

    context "when generate_query_embedding fails" do
      before do
        generate_operation = instance_double(Ai::Operations::Embeddings::GenerateQueryEmbedding)
        allow(Ai::Operations::Embeddings::GenerateQueryEmbedding).to receive(:new).and_return(generate_operation)
        allow(generate_operation).to receive(:call).and_return(
          Dry::Monads::Result::Failure.new({ embedding_error: "Failed to generate query embedding: API error" })
        )
      end

      it "returns a failure" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:embedding_error)
        expect(result.failure[:embedding_error]).to include("Failed to generate query embedding")
      end
    end

    context "when perform_vector_search fails" do
      before do
        # Mock the Ai::RagEmbedding class to raise an error
        allow(Ai::RagEmbedding).to receive(:for_space).and_raise(StandardError.new("Search error"))
      end

      it "returns a failure" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:embedding_error)
      end
    end

    context "when format_results fails" do
      before do
        # Mock the search results to cause an error in format_results
        allow(search_results).to receive(:map).and_raise(StandardError.new("Format error"))
      end

      it "returns a failure" do
        result = operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:embedding_error)
      end
    end
  end

  describe "private methods" do
    describe "#generate_query_embedding" do
      it "calls GenerateQueryEmbedding operation with correct parameters" do
        generate_operation = instance_double(Ai::Operations::Embeddings::GenerateQueryEmbedding)
        allow(Ai::Operations::Embeddings::GenerateQueryEmbedding).to receive(:new).and_return(generate_operation)
        allow(generate_operation).to receive(:call).and_return(Dry::Monads::Result::Success.new(embedding_vector))

        result = operation.send(:generate_query_embedding, params: params)

        expect(result).to be_success
        expect(result.value!).to eq(embedding_vector)
        expect(generate_operation).to have_received(:call).with(query: "Find my grocery expenses")
      end

      it "returns failure when GenerateQueryEmbedding operation fails" do
        generate_operation = instance_double(Ai::Operations::Embeddings::GenerateQueryEmbedding)
        allow(Ai::Operations::Embeddings::GenerateQueryEmbedding).to receive(:new).and_return(generate_operation)
        allow(generate_operation).to receive(:call).and_return(Dry::Monads::Result::Failure.new({ embedding_error: "API error" }))

        result = operation.send(:generate_query_embedding, params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:embedding_error)
      end
    end

    describe "#perform_vector_search" do
      let(:query_embedding) { embedding_vector }
      let(:rag_embedding) do
        embedding = create(:ai_rag_embedding,
                          space: space,
                          embeddable: transaction,
                          content: "Transaction: Grocery purchase",
                          embedding: embedding_vector,
                          metadata: {
                            transaction_type: "Transactions::Expense",
                            category: category.name,
                            account: account.name,
                            date: transaction.date.iso8601
                          })
        # Add neighbor_distance method to the embedding object
        def embedding.neighbor_distance
          0.2
        end
        embedding
      end
      let(:search_results) { [rag_embedding] }

      before do
        allow(Ai::RagEmbedding).to receive(:nearest_neighbors_optimized).and_return(search_results)
      end

      it "performs vector search successfully" do
        result = operation.send(:perform_vector_search, query_embedding: query_embedding, params: params)
        expect(result).to be_success
        expect(result.value!).to eq(search_results)
      end

      it "applies embeddable_type filter when provided" do
        filtered_params = params.merge(embeddable_type: "Transactions::Transaction")
        result = operation.send(:perform_vector_search, query_embedding: query_embedding, params: filtered_params)
        expect(result).to be_success
      end

      it "applies additional filters when provided" do
        filtered_params = params.merge(filters: { transaction_type: "Transactions::Expense" })
        result = operation.send(:perform_vector_search, query_embedding: query_embedding, params: filtered_params)
        expect(result).to be_success
      end

      it "uses default limit and threshold when not provided" do
        params_without_defaults = params.except(:limit, :threshold)
        result = operation.send(:perform_vector_search, query_embedding: query_embedding, params: params_without_defaults)
        expect(result).to be_success
      end

      it "calls nearest_neighbors_optimized with correct parameters" do
        allow(Ai::RagEmbedding).to receive(:nearest_neighbors_optimized).and_return(search_results)

        operation.send(:perform_vector_search, query_embedding: query_embedding, params: params)

        expect(Ai::RagEmbedding).to have_received(:nearest_neighbors_optimized).with(
          query_embedding,
          limit: 10,
          threshold: 0.7
        )
      end
    end

    describe "#apply_filters" do
      let(:scope) { Ai::RagEmbedding.for_space(space.id) }

      it "applies embeddable_type filter" do
        filters = { embeddable_type: "Transactions::Transaction" }
        result = operation.send(:apply_filters, scope, filters)
        expect(result).to be_a(ActiveRecord::Relation)
      end

      it "applies transaction_type filter" do
        filters = { transaction_type: "Transactions::Expense" }
        result = operation.send(:apply_filters, scope, filters)
        expect(result).to be_a(ActiveRecord::Relation)
      end

      it "applies category filter" do
        filters = { category: "Food" }
        result = operation.send(:apply_filters, scope, filters)
        expect(result).to be_a(ActiveRecord::Relation)
      end

      it "applies account filter" do
        filters = { account: "Cash" }
        result = operation.send(:apply_filters, scope, filters)
        expect(result).to be_a(ActiveRecord::Relation)
      end

      it "applies date_from filter" do
        filters = { date_from: "2024-01-01" }
        result = operation.send(:apply_filters, scope, filters)
        expect(result).to be_a(ActiveRecord::Relation)
      end

      it "applies date_to filter" do
        filters = { date_to: "2024-12-31" }
        result = operation.send(:apply_filters, scope, filters)
        expect(result).to be_a(ActiveRecord::Relation)
      end

      it "applies multiple filters" do
        filters = {
          embeddable_type: "Transactions::Transaction",
          transaction_type: "Transactions::Expense",
          category: "Food",
          account: "Cash",
          date_from: "2024-01-01",
          date_to: "2024-12-31"
        }
        result = operation.send(:apply_filters, scope, filters)
        expect(result).to be_a(ActiveRecord::Relation)
      end

      it "returns original scope when no filters provided" do
        result = operation.send(:apply_filters, scope, {})
        expect(result).to eq(scope)
      end

      it "handles empty or nil filters" do
        result = operation.send(:apply_filters, scope, nil)
        expect(result).to eq(scope)
      end
    end

    describe "#format_results" do
      let(:rag_embedding) do
        embedding = create(:ai_rag_embedding,
                          space: space,
                          embeddable: transaction,
                          content: "Transaction: Grocery purchase",
                          embedding: embedding_vector,
                          metadata: {
                            transaction_type: "Transactions::Expense",
                            category: category.name,
                            account: account.name,
                            date: transaction.date.iso8601
                          })
        # Add neighbor_distance method to the embedding object
        def embedding.neighbor_distance
          0.2
        end
        embedding
      end

      let(:search_results) { [rag_embedding] }

      before do
        # Mock neighbor_distance method
        allow(rag_embedding).to receive(:neighbor_distance).and_return(0.2)
      end

      it "formats results correctly" do
        result = operation.send(:format_results, results: search_results, params: params)
        expect(result).to be_success

        formatted_data = result.value!
        expect(formatted_data).to include(
          query: "Find my grocery expenses",
          results: kind_of(Array),
          total_count: 1,
          space_id: space.id
        )

        formatted_result = formatted_data[:results].first
        expect(formatted_result).to include(
          id: rag_embedding.id,
          embeddable_id: rag_embedding.embeddable_id,
          embeddable_type: rag_embedding.embeddable_type,
          content: rag_embedding.content,
          metadata: rag_embedding.metadata,
          similarity_score: 0.8, # 1 - 0.2
          distance: 0.2
        )
      end

      it "handles empty results" do
        result = operation.send(:format_results, results: [], params: params)
        expect(result).to be_success

        formatted_data = result.value!
        expect(formatted_data[:results]).to be_empty
        expect(formatted_data[:total_count]).to eq(0)
      end

      it "calculates similarity score correctly" do
        allow(rag_embedding).to receive(:neighbor_distance).and_return(0.1)
        result = operation.send(:format_results, results: search_results, params: params)
        formatted_result = result.value![:results].first

        expect(formatted_result[:similarity_score]).to eq(0.9) # 1 - 0.1
        expect(formatted_result[:distance]).to eq(0.1)
      end

      it "handles multiple results" do
        # Create a different transaction to avoid unique constraint violation
        transaction2 = create(:expense_transaction, space: space, account: account, category: category)
        rag_embedding2 = create(:ai_rag_embedding,
                                space: space,
                                embeddable: transaction2,
                                content: "Another transaction",
                                embedding: embedding_vector)

        # Define the neighbor_distance method on the objects
        rag_embedding.define_singleton_method(:neighbor_distance) { 0.2 }
        rag_embedding2.define_singleton_method(:neighbor_distance) { 0.3 }

        multiple_results = [rag_embedding, rag_embedding2]
        result = operation.send(:format_results, results: multiple_results, params: params)
        expect(result).to be_success

        formatted_data = result.value!
        expect(formatted_data[:results].length).to eq(2)
        expect(formatted_data[:total_count]).to eq(2)
      end
    end
  end
end
