# frozen_string_literal: true

module Ai
  module Operations
    module Conversations
      class CreateConversation < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).value(:string)
            required(:space_id).value(:string)
            required(:title).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          openai_conversation_id = step create_openai_conversation(params:)
          conversation = step create_database_conversation(params:, openai_conversation_id:)
          conversation
        end

        private

        def create_openai_conversation(params:)
          client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])

          response = client.conversations.create(
            parameters: {
              metadata: { topic: params[:title] || "New Conversation" }
            }
          )
          Success(response["id"])
        rescue StandardError => e
          Rails.logger.error "[CREATE_OPENAI_CONVERSATION] OpenAI Conversation Creation Error: #{e.message}"
          Failure(openai_error: e.message)
        end

        def create_database_conversation(params:, openai_conversation_id:)
          conversation = Ai::Conversation.new(**params, openai_conversation_id:)

          if conversation.save
            Success(conversation)
          else
            Failure(conversation.errors.full_messages)
          end
        end
      end
    end
  end
end
