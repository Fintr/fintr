# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Embeddings::GenerateEmbedding, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space: space) }
  let(:to_account) { create(:account, space: space) }
  let(:category) { create(:category, space: space) }
  let(:transaction) { create(:expense_transaction, space: space, account: account, category: category) }
  let(:transfer) { create(:transfer, space: space, from_account: account, to_account: to_account) }
  let(:embedding_vector) { Array.new(1536) { rand(-1.0..1.0) } }
  let(:content) { "Transaction: Test transaction, Amount: -100.00 PHP, Category: Food, Account: Cash, Date: January 01, 2024, Type: Transactions::Expense, Space: Personal Space" }

  describe "Contract" do
    let(:params) do
      {
        embeddable_id: transaction.id,
        embeddable_type: "Transactions::Transaction",
        space_id: space.id
      }
    end

    it "succeeds with valid parameters" do
      result = operation.validate(params: params)
      expect(result).to be_success
    end

    it "fails without embeddable_id" do
      params.delete(:embeddable_id)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:embeddable_id)
    end

    it "fails without embeddable_type" do
      params.delete(:embeddable_type)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:embeddable_type)
    end

    it "fails without space_id" do
      params.delete(:space_id)
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails with invalid embeddable_id type" do
      params[:embeddable_id] = 123
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:embeddable_id)
    end

    it "fails with invalid embeddable_type type" do
      params[:embeddable_type] = 123
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:embeddable_type)
    end

    it "fails with invalid space_id type" do
      params[:space_id] = 123
      result = operation.validate(params: params)
      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end
  end

  describe "#call" do
    let(:params) do
      {
        embeddable_id: transaction.id,
        embeddable_type: "Transactions::Transaction",
        space_id: space.id
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

    before do
      # Mock OpenAI client
      openai_client = instance_double(OpenAI::Client)
      allow(OpenAI::Client).to receive(:new).and_return(openai_client)
      allow(openai_client).to receive(:embeddings).and_return(openai_response)

      # Mock PrepareContent operation
      allow(Ai::Operations::Embeddings::PrepareContent).to receive(:new) do |*args|
        instance_double(Ai::Operations::Embeddings::PrepareContent).tap do |op|
          allow(op).to receive(:call).and_return(Success(content))
        end
      end
    end

    context "when all steps succeed" do
      it "successfully generates and stores embedding for transaction" do
        result = operation.call(params)
        expect(result).to be_success
        expect(result.value!).to be_a(Ai::RagEmbedding)
        expect(result.value!.embeddable).to eq(transaction)
        expect(result.value!.space).to eq(space)
        expect(result.value!.content).to eq(content)
        expect(result.value!.embedding).to eq(embedding_vector)
      end

      it "creates a new embedding record" do
        expect { operation.call(params) }.to change(Ai::RagEmbedding, :count).by(1)
      end

      it "stores the correct metadata for transaction" do
        result = operation.call(params)
        embedding_record = result.value!

        expect(embedding_record.metadata).to include(
          "embeddable_type" => "Transactions::Expense",
          "transaction_type" => "Transactions::Expense",
          "category" => category.name,
          "account" => account.name,
          "amount" => 100.0,
          "amount_display" => -100.0,
          "date" => transaction.date.iso8601
        )
      end
    end

    context "when embeddable is a transfer" do
      let(:params) do
        {
          embeddable_id: transfer.id,
          embeddable_type: "Transactions::Transfer",
          space_id: space.id
        }
      end

      it "successfully generates and stores embedding for transfer" do
        result = operation.call(params)
        expect(result).to be_success
        expect(result.value!).to be_a(Ai::RagEmbedding)
        expect(result.value!.embeddable).to eq(transfer)
      end

      it "stores the correct metadata for transfer" do
        result = operation.call(params)
        embedding_record = result.value!

        expect(embedding_record.metadata).to include(
          "embeddable_type" => "Transactions::Transfer",
          "from_account" => account.name,
          "to_account" => to_account.name,
          "amount" => 100.0,
          "transaction_cost" => 0.0,
          "date" => transfer.date.iso8601
        )
      end
    end

    context "when validate fails" do
      let(:params) { { embeddable_id: nil, embeddable_type: "Transactions::Transaction", space_id: space.id } }

      it "returns a failure" do
        expect { operation.call(params) }.to raise_error(StandardError, "Ai::Operations::Embeddings::GenerateEmbedding failed")
      end
    end

    context "when find_embeddable fails" do
      let(:params) do
        {
          embeddable_id: "non-existent-id",
          embeddable_type: "Transactions::Transaction",
          space_id: space.id
        }
      end

      it "returns a failure when embeddable is not found" do
        expect { operation.call(params) }.to raise_error(StandardError, "Ai::Operations::Embeddings::GenerateEmbedding failed")
      end
    end

    context "when embeddable_type is invalid" do
      let(:params) do
        {
          embeddable_id: transaction.id,
          embeddable_type: "InvalidType",
          space_id: space.id
        }
      end

      it "returns a failure for invalid embeddable type" do
        expect { operation.call(params) }.to raise_error(StandardError, "Ai::Operations::Embeddings::GenerateEmbedding failed")
      end
    end

    context "when prepare_content fails" do
      before do
        allow(Ai::Operations::Embeddings::PrepareContent).to receive(:new) do |*args|
          instance_double(Ai::Operations::Embeddings::PrepareContent).tap do |op|
            allow(op).to receive(:call).and_return(Failure(prepare_error: "Failed to prepare content"))
          end
        end
      end

      it "returns a failure" do
        expect { operation.call(params) }.to raise_error(StandardError, "Ai::Operations::Embeddings::GenerateEmbedding failed")
      end
    end

    context "when generate_embedding_vector fails" do
      before do
        openai_client = instance_double(OpenAI::Client)
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:embeddings).and_raise(StandardError.new("API error"))
      end

      it "returns a failure" do
        expect { operation.call(params) }.to raise_error(StandardError, "Ai::Operations::Embeddings::GenerateEmbedding failed")
      end
    end

    context "when store_embedding fails" do
      before do
        allow_any_instance_of(Ai::RagEmbedding).to receive(:save!).and_raise(StandardError.new("Database error"))
      end

      it "returns a failure" do
        expect { operation.call(params) }.to raise_error(StandardError, "Ai::Operations::Embeddings::GenerateEmbedding failed")
      end
    end

    context "when updating existing embedding" do
      let!(:existing_embedding) do
        create(:ai_rag_embedding,
               embeddable: transaction,
               space: space,
               content: "old content",
               embedding: Array.new(1536, 0.0))
      end

      it "updates the existing embedding record" do
        expect { operation.call(params) }.not_to change(Ai::RagEmbedding, :count)

        result = operation.call(params)
        expect(result).to be_success

        existing_embedding.reload
        expect(existing_embedding.content).to eq(content)
        expect(existing_embedding.embedding.first(5).map { |x| x.round(5) }).to eq(embedding_vector.first(5).map { |x| x.round(5) })
      end
    end
  end

  describe "private methods" do
    describe "#find_embeddable" do
      let(:params) do
        {
          embeddable_id: transaction.id,
          embeddable_type: "Transactions::Transaction",
          space_id: space.id
        }
      end

      it "returns success with found embeddable" do
        result = operation.send(:find_embeddable, params: params)
        expect(result).to be_success
        expect(result.value!).to eq(transaction)
      end

      it "returns failure when embeddable is not found" do
        params[:embeddable_id] = "non-existent-id"
        result = operation.send(:find_embeddable, params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:embeddable_id)
        expect(result.failure[:embeddable_id]).to eq("not found")
      end

      it "returns failure for invalid embeddable type" do
        params[:embeddable_type] = "InvalidType"
        result = operation.send(:find_embeddable, params: params)
        expect(result).to be_failure
        expect(result.failure).to have_key(:embeddable_type)
        expect(result.failure[:embeddable_type]).to eq("invalid type")
      end
    end

    describe "#generate_embedding_vector" do
      let(:openai_response) do
        {
          "data" => [
            {
              "embedding" => embedding_vector
            }
          ]
        }
      end

      before do
        openai_client = instance_double(OpenAI::Client)
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:embeddings).and_return(openai_response)
      end

      it "returns success with embedding vector" do
        result = operation.send(:generate_embedding_vector, content: content)
        expect(result).to be_success
        expect(result.value!).to eq(embedding_vector)
      end

      it "calls OpenAI with correct parameters" do
        openai_client = instance_double(OpenAI::Client)
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:embeddings).and_return(openai_response)

        operation.send(:generate_embedding_vector, content: content)

        expect(openai_client).to have_received(:embeddings).with(
          parameters: {
            model: "text-embedding-3-small",
            input: content
          }
        )
      end

      it "returns failure when OpenAI API fails" do
        openai_client = instance_double(OpenAI::Client)
        allow(OpenAI::Client).to receive(:new).and_return(openai_client)
        allow(openai_client).to receive(:embeddings).and_raise(StandardError.new("API error"))

        result = operation.send(:generate_embedding_vector, content: content)
        expect(result).to be_failure
        expect(result.failure).to have_key(:embedding_error)
        expect(result.failure[:embedding_error]).to include("Failed to generate embedding")
      end
    end

    describe "#store_embedding" do
      let(:params) do
        {
          embeddable_id: transaction.id,
          embeddable_type: "Transactions::Transaction",
          space_id: space.id
        }
      end

      it "creates a new embedding record" do
        expect do
          operation.send(:store_embedding,
                        embeddable: transaction,
                        content: content,
                        embedding: embedding_vector,
                        params: params)
        end.to change(Ai::RagEmbedding, :count).by(1)
      end

      it "returns success with created embedding record" do
        result = operation.send(:store_embedding,
                               embeddable: transaction,
                               content: content,
                               embedding: embedding_vector,
                               params: params)

        expect(result).to be_success
        expect(result.value!).to be_a(Ai::RagEmbedding)
        expect(result.value!.embeddable).to eq(transaction)
        expect(result.value!.space).to eq(space)
        expect(result.value!.content).to eq(content)
        expect(result.value!.embedding).to eq(embedding_vector)
      end

      it "updates existing embedding record" do
        existing_embedding = create(:ai_rag_embedding,
                                   embeddable: transaction,
                                   space: space,
                                   content: "old content",
                                   embedding: Array.new(1536, 0.0))

        result = operation.send(:store_embedding,
                               embeddable: transaction,
                               content: content,
                               embedding: embedding_vector,
                               params: params)

        expect(result).to be_success
        expect(result.value!).to eq(existing_embedding)

        existing_embedding.reload
        expect(existing_embedding.content).to eq(content)
        expect(existing_embedding.embedding.length).to eq(embedding_vector.length)
        expect(existing_embedding.embedding.first(5).map { |x| x.round(5) }).to eq(embedding_vector.first(5).map { |x| x.round(5) })
      end

      it "returns failure when save fails" do
        allow_any_instance_of(Ai::RagEmbedding).to receive(:save!).and_raise(StandardError.new("Database error"))

        result = operation.send(:store_embedding,
                               embeddable: transaction,
                               content: content,
                               embedding: embedding_vector,
                               params: params)

        expect(result).to be_failure
        expect(result.failure).to have_key(:store_error)
        expect(result.failure[:store_error]).to include("Failed to store embedding")
      end
    end

    describe "#build_metadata" do
      context "when embeddable is a transaction" do
        it "builds correct metadata for expense transaction" do
          result = operation.send(:build_metadata, embeddable: transaction)

          expect(result).to include(
            embeddable_type: "Transactions::Expense",
            transaction_type: "Transactions::Expense",
            category: category.name,
            account: account.name,
            amount: 100.0,
            amount_display: -100.0,
            date: transaction.date.iso8601
          )
        end

        it "builds correct metadata for income transaction" do
          income_transaction = create(:income_transaction, space: space, account: account, category: category, amount: 200.0)
          result = operation.send(:build_metadata, embeddable: income_transaction)

          expect(result).to include(
            embeddable_type: "Transactions::Income",
            transaction_type: "Transactions::Income",
            amount: 200.0,
            amount_display: 200.0
          )
        end
      end

      context "when embeddable is a transfer" do
        it "builds correct metadata for transfer" do
          result = operation.send(:build_metadata, embeddable: transfer)

        expect(result).to include(
          embeddable_type: "Transactions::Transfer",
          from_account: account.name,
          to_account: to_account.name,
          amount: 100.0,
          transaction_cost: 0.0,
          date: transfer.date.iso8601
        )
        end

        it "builds correct metadata for transfer with transaction cost" do
          transfer_with_cost = create(:transfer, :with_transaction_cost, space: space, from_account: account, to_account: to_account)
          result = operation.send(:build_metadata, embeddable: transfer_with_cost)

          expect(result).to include(
            embeddable_type: "Transactions::Transfer",
            amount: 100.0,
            transaction_cost: 5.0
          )
        end
      end
    end
  end
end
