# frozen_string_literal: true

module Ai
  module Operations
    module Embeddings
      class GenerateEmbedding < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:embeddable_id).value(:string)
            required(:embeddable_type).value(:string)
            required(:space_id).value(:string)
          end
        end

        def call(params)
          params = step validate(params:)
          embeddable = step find_embeddable(params:)
          content = step prepare_content(embeddable:)
          embedding = step generate_embedding_vector(content:)
          result = step store_embedding(embeddable:, content:, embedding:, params:)
          result
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Success(contract.to_h) if contract.success?

          Failure(contract.errors.to_h)
        end

        private

        def find_embeddable(params:)
          embeddable = params[:embeddable_type].constantize.find(params[:embeddable_id])
          Success(embeddable)
        rescue ActiveRecord::RecordNotFound
          Failure(embeddable_id: "not found")
        rescue NameError
          Failure(embeddable_type: "invalid type")
        end

        def prepare_content(embeddable:)
          Ai::Operations::Embeddings::PrepareContent.new.call(embeddable:)
        end

        def generate_embedding_vector(content:)
          client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])

          response = client.embeddings(
            parameters: {
              model: "text-embedding-3-small",
              input: content
            }
          )

          embedding_vector = response.dig("data", 0, "embedding")
          Success(embedding_vector)
        rescue StandardError => e
          Failure(embedding_error: "Failed to generate embedding: #{e.message}")
        end

        def store_embedding(embeddable:, content:, embedding:, params:)
          embedding_record = Ai::RagEmbedding.find_or_initialize_by(
            embeddable: embeddable,
            space_id: params[:space_id]
          )


          metadata = build_metadata(embeddable:)

          embedding_record.assign_attributes(
            content: content,
            embedding: embedding,
            metadata: metadata
          )


          embedding_record.save!
          Success(embedding_record)
        rescue StandardError => e
          Failure(store_error: "Failed to store embedding: #{e.message}")
        end

        def build_metadata(embeddable:)
          case embeddable
          when Transactions::Transaction
            {
              embeddable_type: embeddable.class.name,
              transaction_type: embeddable.type,
              category: embeddable.category.name,
              account: embeddable.account.name,
              amount: embeddable.amount.to_f,
              amount_display: case embeddable.type
                              when "Transactions::Expense" then -embeddable.amount.to_f
                              when "Transactions::Income" then embeddable.amount.to_f
                              else embeddable.amount.to_f
                              end,
              date: embeddable.date.iso8601
            }
          when Transactions::Transfer
            {
              embeddable_type: embeddable.class.name,
              from_account: embeddable.from_account.name,
              to_account: embeddable.to_account.name,
              amount: embeddable.amount.to_f,
              transaction_cost: embeddable.transaction_cost.to_f,
              date: embeddable.date.iso8601
            }
          end
        end

        def on_failure(result)
          raise StandardError, "Ai::Operations::Embeddings::GenerateEmbedding failed: #{result.inspect}"
        end
      end
    end
  end
end
