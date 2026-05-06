# frozen_string_literal: true

module Crm
  module Operations
    class CreateTicketResponse < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled
          required(:ticket_id).filled(:string)
          required(:message).filled(:string)
          optional(:images).value(:array)
        end

        rule(:message) do
          key.failure("must be at most 1000 characters") if value.length > 1000
        end

        rule(:images) do
          next unless value

          key.failure("cannot exceed 5 images") if value.length > 5
        end
      end

      def call(params)
        response, params = ActiveRecord::Base.transaction do
          params = step validate(params)
          user = step find_user(params)
          ticket = step find_ticket(user, params)
          response = step build_response(ticket, params)
          _ = step save_response(response)
          _ = step update_ticket_status(ticket)
         [response, params]
        end
        _ = step attach_images(response, params)
        response
      end

      private

      def validate(params)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def find_user(params)
        user = Auth::User.find_by(id: params[:user_id])
        return Failure(user_id: "User not found") unless user

        Success(user)
      end

      def find_ticket(user, params)
        ticket = user.tickets.find_by(id: params[:ticket_id])
        return Failure(ticket_id: "Ticket not found") unless ticket

        Success(ticket)
      end

      def build_response(ticket, params)
        response = ticket.ticket_responses.build(
          message: params[:message],
          responder_id: params[:user_id],
          response_type: "user_reply"
        )

        Success(response)
      end

      def save_response(response)
        return Failure(response.errors.full_messages) unless response.valid?

        ActiveRecord::Base.transaction do
          response.save!
        end

        Success(response)
      rescue StandardError => e
        Rails.logger.error("CreateTicketResponse error: #{e.message}")
        Failure(error: e.message)
      end

      def update_ticket_status(ticket)
        # Automatically reopen ticket if it was closed and user adds a response
        if ticket.dismissed? || ticket.resolved?
          ActiveRecord::Base.transaction do
            ticket.update!(status: "open")
          end
        end

        Success(ticket)
      rescue StandardError => e
        Rails.logger.error("UpdateTicketStatus error: #{e.message}")
        Failure(error: e.message)
      end

      def attach_images(response, params)
        if params[:images].present?
          params[:images].each do |image|
            response.images.attach(image)
          end
        end
        Success(response)
      end
    end
  end
end
