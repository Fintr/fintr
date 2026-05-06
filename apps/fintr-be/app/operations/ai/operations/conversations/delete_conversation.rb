# frozen_string_literal: true

module Ai
  module Operations
    module Conversations
      class DeleteConversation < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:conversation_id).value(:string)
            required(:user_id).value(:string)
            required(:space_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          conversation = step find_conversation(params:)
          step delete_database_conversation(conversation:)
          conversation
        end

        private

        def find_conversation(params:)
          conversation = Ai::Conversation.find_by(
            **params.except(:conversation_id),
            id: params[:conversation_id]
          )
          return Failure(conversation_not_found: "Conversation not found") unless conversation

          Success(conversation)
        end

        def delete_openai_conversation(conversation:)
          client = OpenAI::Client.new(access_token: ENV["OPENAI_API_KEY"])
          client.conversations.delete(id: conversation.openai_conversation_id)
          Success()
        end

        def delete_database_conversation(conversation:)
          conversation.destroy!
          Success(conversation)
        rescue StandardError => e
          Failure(database_error: e.message)
        end
      end
    end
  end
end
