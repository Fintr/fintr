# frozen_string_literal: true

module Api
  module V1
    module Ai
      class RagController < ApiController
        def query
          # Check if space has available tokens before processing
          unless current_space.can_ai?
            return render_error(
              message: "Token limit reached. You have used all available AI tokens for this space.",
              status: :forbidden
            )
          end

          session_id = SecureRandom.uuid
          conversation_id = rag_params[:conversation_id]


          Rails.logger.info "[RAG] Query: #{rag_params[:query]}"
          Rails.logger.info "[RAG] Params: #{rag_params.inspect}"

          # Create or find conversation
          conversation = if conversation_id.present?
            current_user.conversations.find_by(id: conversation_id, space_id: with_current_params[:space_id])
          else
            # Create new conversation using operation
            operation = ::Ai::Operations::Conversations::CreateConversation.new.call(
              **with_current_params,
              title: rag_params[:query]&.truncate(50) || "New Conversation"
            )

            if operation.success?
              operation.value!
            else
              return render_unprocessable_content(
                message: "Failed to create conversation",
                details: operation.failure
              )
            end
          end


          Rails.logger.info "[RAG] Conversation: #{conversation&.inspect}"


          # Add user message to conversation
          conversation.add_user_message(rag_params[:query])

          # Start background processing with OpenAI conversation context
          Rails.logger.info "[RagController] 📤 Enqueuing AiChatJob for session #{session_id}, conversation #{conversation.id}"
          Rails.logger.info "[RagController] Job params: session_id=#{session_id}, query=#{rag_params[:query]}, space_id=#{with_current_params[:space_id]}, user_id=#{with_current_params[:user_id]}, conversation_id=#{conversation.id}"

          # Create usage record (non-blocking)
          operation = ::Ai::Operations::Usages::CreateUsage.new.call(
            user_id: with_current_params[:user_id],
            space_id: with_current_params[:space_id],
            ai_type: "ai_chat",
            tokens_used: 3
          ) do
            ::Ai::AiChatJob.perform_later(
              session_id,
              rag_params[:query],
              with_current_params[:space_id],
              with_current_params[:user_id], conversation.id
            )
            Dry::Monads::Success(true)
          end

          unless operation.success?
            Rails.logger.warn "[RagController] ⚠️ Usage creation failed, but job is enqueued: #{operation.failure}"
          end

          render json: {
            session_id: session_id,
            status: "processing",
            conversation_id: conversation.id
          }
        end


        private

        def set_space
          @space = current_user.spaces.find_by!(code: request.headers["X-Space-Code"])
        end

        def rag_params
          params.permit(:query, :conversation_id)
        end
      end
    end
  end
end
