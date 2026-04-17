# frozen_string_literal: true

module Api
  module V1
    module Crm
      class TicketsController < ApiController
        before_action :set_ticket, only: [:show]

        def index
          query = ::Crm::Queries::FilteredTickets.call(
            relation: current_space.tickets.where(user_id: current_user.id),
            params: filter_params
          )

          return render_internal_server_error(details: query.failure) unless query.success?

          render_paginated(
            query.value!,
            serializer: ::Crm::Serializers::TicketListSerializer,
            key: :tickets
          )
        end

        def show
          serializer = ::Crm::Serializers::TicketDetailSerializer.render_as_hash(@ticket)
          render_success(data: serializer)
        end

        def create
          operation = ::Crm::Operations::CreateTicket.new.call(
            with_current_params(create_params)
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_created(record: operation.value!)
        end

        private

        def set_ticket
          @ticket = current_space.tickets.where(user_id: current_user.id).find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_not_found(message: "Ticket not found")
        end

        def filter_params
          params.permit(:status, :ticket_type, :priority, :page, :per_page, :search_query).to_h
        end

        def create_params
          params.permit(
            :title,
            :description,
            :ticket_type,
            :priority,
            images: []
          )
        end
      end
    end
  end
end
