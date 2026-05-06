# frozen_string_literal: true

module Crm
  module Serializers
    module Admin
      class AdminTicketListSerializer < Blueprinter::Base
        identifier :id

        fields :title,
               :ticket_type,
               :description,
               :priority,
               :status,
               :created_at,
               :updated_at

        field :response_count do |ticket|
          ticket.response_count
        end

        field :has_unread_responses do |ticket|
          ticket.has_unread_responses?
        end

        field :user_info do |ticket|
          {
            id: ticket.user.id,
            full_name: ticket.user.full_name,
            email: ticket.user.email,
            space_id: ticket.space_id,
            created_at: ticket.user.created_at
          }
        end

        field :latest_response_at do |ticket|
          ticket.latest_response&.created_at
        end
      end
    end
  end
end
