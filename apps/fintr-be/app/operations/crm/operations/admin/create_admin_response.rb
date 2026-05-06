# frozen_string_literal: true

module Crm
  module Operations
    module Admin
      class CreateAdminResponse < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:ticket_id).filled(:string)
            required(:message).filled(:string)
            required(:user_id).filled(:string)
            optional(:images).value(:array)
          end

          rule(:message) do
            key.failure("must be at most 1000 characters") if value.length > 1000
          end
        end

        def call(params)
          response, validated_params, space = ActiveRecord::Base.transaction do
            validated_params = step validate(params)
            ticket = step find_ticket(validated_params[:ticket_id])
            space = step find_space(ticket)
            response = step create_response(ticket, validated_params)
            _ = step update_ticket_status(ticket)
            [response, validated_params, space]
          end
          _ = step attach_images(response, validated_params, space)
          response
        end

        private

        def validate(params)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def find_ticket(ticket_id)
          ticket = Crm::Ticket.find_by(id: ticket_id)
          return Failure(["Ticket not found"]) unless ticket

          Success(ticket)
        end

        def find_space(ticket)
          Success(ticket.space)
        end

        def create_response(ticket, params)
          response = ticket.ticket_responses.build(
            message: params[:message],
            responder_id: params[:user_id],
            response_type: "admin_response"
          )

          return Failure(response.errors.full_messages) unless response.valid?

          response.save!

          Success(response)
        rescue StandardError => e
          Rails.logger.error("CreateAdminResponse error: #{e.message}")
          Failure(error: e.message)
        end

        def update_ticket_status(ticket)
          if ticket.open?
            ticket.update!(status: "in_progress")
          end

          Success(ticket)
        rescue StandardError => e
          Rails.logger.error("UpdateTicketStatus error: #{e.message}")
          Failure(error: e.message)
        end

        def attach_images(response, params, space)
          if params[:images].present?
            params[:images].each do |image|
              Utils::ActiveStorage.attach_file(response.images, image, space.id)
            end
          end

          Success(response)
        end
      end
    end
  end
end
