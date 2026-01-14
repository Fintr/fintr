# frozen_string_literal: true

module Api
  module V1
    module Ai
      class ConversationsController < ApiController
        def index
          conversations = current_user.conversations
                                    .for_space(with_current_params[:space_id])
                                    .recent
                                    .includes(:conversation_messages)
                                    .limit(50)

          render_success(data: ::Ai::Serializers::ConversationSerializer.render_as_hash(conversations))
        end

        def show
          conversation = current_user.conversations
                                   .for_space(with_current_params[:space_id])
                                   .find(params[:id])

          # Check if pagination is requested
          if conversation_params[:page].present?
            query = ::Ai::Queries::PaginatedMessages.call(
              relation: conversation.conversation_messages,
              params: with_current_params(conversation_params).merge(conversation_id: conversation.id)
            )

            return render_internal_server_error(details: query.failure) unless query.success?

            render_paginated(
              query.value!,
              serializer: ::Ai::Serializers::ConversationMessageSerializer,
              key: :messages
            )
          else
            # Return full conversation with all messages
            render_success(data: ::Ai::Serializers::ConversationWithMessagesSerializer.render_as_hash(conversation))
          end
        end

        def create
          operation = ::Ai::Operations::Conversations::CreateConversation.new.call(
            **with_current_params,
            title: conversation_params[:title] || "New Conversation"
          )

          if operation.success?
            render_created(record: operation.value!)
          else
            render_unprocessable_content(
              message: "Failed to create conversation",
              details: operation.failure
            )
          end
        end

        def update
          conversation = current_user.conversations
                                   .for_space(with_current_params[:space_id])
                                   .find(params[:id])

          if conversation.update(conversation_params)
            render json: ::Ai::Serializers::ConversationSerializer.render(conversation)
          else
            render_unprocessable_content(
              message: "Failed to update conversation",
              details: conversation.errors.full_messages
            )
          end
        end

        def destroy
          operation = ::Ai::Operations::Conversations::DeleteConversation.new.call(
            **with_current_params,
            conversation_id: params[:id]
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(message: "Conversation deleted successfully")
        end

        private

        def conversation_params
          params.permit(:title, :page, :per_page)
        end
      end
    end
  end
end
