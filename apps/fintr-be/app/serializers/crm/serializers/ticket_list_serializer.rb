# frozen_string_literal: true

module Crm
  module Serializers
    class TicketListSerializer < Blueprinter::Base
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

      field :user_name do |ticket|
        ticket.user&.full_name || ticket.user&.email || "Unknown User"
      end

      field :latest_response_at do |ticket|
        ticket.latest_response&.created_at
      end
    end
  end
end
