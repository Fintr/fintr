# frozen_string_literal: true

module Api
  module V1
    module Crm
      class TicketResponsesController < ApiController
        skip_before_action :ensure_space_access!
        before_action :set_ticket

        def create
          operation = ::Crm::Operations::CreateTicketResponse.new.call(
            with_current_params(create_params.merge(ticket_id: @ticket.id))
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_created(record: operation.value!)
        end

        private

        def set_ticket
          @ticket = current_user.tickets.find(params[:ticket_id])
        rescue ActiveRecord::RecordNotFound
          render_not_found(message: "Ticket not found")
        end

        def create_params
          params.permit(:message, images: [])
        end
      end
    end
  end
end
