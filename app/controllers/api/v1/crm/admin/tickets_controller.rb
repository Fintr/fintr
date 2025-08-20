# frozen_string_literal: true

module Api
  module V1
    module Crm
      module Admin
        class TicketsController < ApiController
          before_action :ensure_admin # You'll need to implement this authorization
          before_action :set_ticket, only: [:show, :update]

          def index
            query = ::Crm::Queries::FilteredTickets.call(
              relation: ::Crm::Ticket.includes(:user, :ticket_responses),
              params: filter_params
            )

            return render_internal_server_error(details: query.failure) unless query.success?

            render_paginated(
              query.value!,
              serializer: ::Crm::Serializers::Admin::AdminTicketListSerializer,
              key: :tickets
            )
          end

          def show
            serializer = ::Crm::Serializers::Admin::AdminTicketDetailSerializer.render_as_hash(@ticket)
            render_success(data: serializer)
          end

          def update
            operation = ::Crm::Operations::Admin::UpdateTicketStatus.new.call(
              with_current_params(update_params.merge(id: @ticket.id))
            )

            return render_unprocessable_content(details: operation.failure) unless operation.success?

            render_success(
              data: { id: operation.value!.id },
              message: "Ticket updated successfully"
            )
          end

          def respond
            operation = ::Crm::Operations::Admin::CreateAdminResponse.new.call(
              with_current_params(response_params.merge(ticket_id: params[:id]))
            )

            return render_unprocessable_content(details: operation.failure) unless operation.success?

            render_created(record: operation.value!)
          end

          private

          def set_ticket
            @ticket = ::Crm::Ticket.find(params[:id])
          rescue ActiveRecord::RecordNotFound
            render_not_found(message: "Ticket not found")
          end

          def filter_params
            params.permit(:status, :ticket_type, :priority, :page, :per_page, :search_query, :user_id).to_h
          end

          def update_params
            params.permit(:status, :priority)
          end

          def response_params
            params.permit(:message, images: [])
          end

          def ensure_admin
            unless current_user.has_role?(:admin)
              render_forbidden(message: "Admin access required")
            end
          end
        end
      end
    end
  end
end
