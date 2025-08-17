# frozen_string_literal: true

module Crm
  module Serializers
    class TicketResponseSerializer < Blueprinter::Base
      identifier :id

      fields :message,
             :response_type,
             :created_at,
             :updated_at

      field :responder_name do |response|
        next "System" unless response.responder

        case response.response_type
        when "admin_response"
          "Support Team"
        when "user_reply"
          response.responder.full_name || response.responder.email
        else
          "System"
        end
      end

      field :images do |response|
        next [] unless response.images.attached?

        response.images.map do |image|
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
    end
  end
end
