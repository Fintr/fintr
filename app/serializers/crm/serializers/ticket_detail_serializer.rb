# frozen_string_literal: true

module Crm
  module Serializers
    class TicketDetailSerializer < Blueprinter::Base
      identifier :id

      fields :title,
             :description,
             :ticket_type,
             :priority,
             :status,
             :created_at,
             :updated_at

      field :user_name do |ticket|
        ticket.user&.full_name || ticket.user&.email || "Unknown User"
      end

      field :images do |ticket|
        next [] unless ticket.images.attached?

        ticket.images.map do |image|
          {
            id: image.id,
            filename: image.filename.to_s,
            content_type: image.content_type,
            byte_size: image.byte_size,
            url: image.url,
            created_at: image.created_at
          }
        end
      end

      field :responses do |ticket|
        TicketResponseSerializer.render_as_hash(
          ticket.ticket_responses.chronological.includes(:responder)
        )
      end
    end
  end
end
