# frozen_string_literal: true

module Crm
  module Serializers
    module Admin
      class AdminTicketDetailSerializer < Blueprinter::Base
        identifier :id

        fields :title,
               :description,
               :ticket_type,
               :priority,
               :status,
               :created_at,
               :updated_at

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

        field :user_info do |ticket|
          {
            id: ticket.user.id,
            full_name: ticket.user.full_name,
            email: ticket.user.email,
            space_id: ticket.space_id,
            created_at: ticket.user.created_at
          }
        end
      end
    end
  end
end
