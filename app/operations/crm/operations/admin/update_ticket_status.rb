# frozen_string_literal: true

module Crm
  module Operations
    module Admin
      class UpdateTicketStatus < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).filled(:string)
            required(:user_id).filled
            optional(:status).filled(:string)
            optional(:priority).filled(:string)
          end

          rule(:status) do
            if key?
              valid_statuses = %w[open in_progress resolved dismissed]
              key.failure("must be one of: #{valid_statuses.join(', ')}") unless valid_statuses.include?(value)
            end
          end

          rule(:priority) do
            if key?
              valid_priorities = %w[low medium high urgent]
              key.failure("must be one of: #{valid_priorities.join(', ')}") unless valid_priorities.include?(value)
            end
          end
        end

        def call(params)
          ActiveRecord::Base.transaction do
            validated_params = step validate(params)
            ticket = step find_ticket(validated_params[:id])
            old_status = ticket.status
            step update_ticket(ticket, validated_params)
            step create_system_update(ticket, old_status, validated_params) if old_status != ticket.status
            ticket
          end
        end

        private

        def validate(params)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def find_user(user_id)
          user = Auth::User.find_by(id: user_id)
          return Failure(user_id: "User not found") unless user

          Success(user)
        end

        def find_ticket(id)
          ticket = Crm::Ticket.find_by(id: id)
          return Failure(id: "Ticket not found") unless ticket

          Success(ticket)
        end

        def update_ticket(ticket, params)
          update_attrs = build_update_attributes(params)
          ticket.assign_attributes(update_attrs)

          return Failure(ticket.errors.full_messages) unless ticket.valid?

          ActiveRecord::Base.transaction do
            ticket.save!
          end

          Success(ticket)
        rescue StandardError => e
          Rails.logger.error("UpdateTicketStatus error: #{e.message}")
          Failure([e.message])
        end

        def create_system_update(ticket, old_status, params)
          message = "Ticket status changed from '#{old_status.humanize}' to '#{ticket.status.humanize}'"

          response = ticket.ticket_responses.build(
            message: message,
            responder_id: params[:user_id],
            response_type: "system_update"
          )

          ActiveRecord::Base.transaction do
            response.save!
          end

          Success(response)
        rescue StandardError => e
          Rails.logger.error("CreateSystemUpdate error: #{e.message}")
          Failure([e.message])
        end

        def build_update_attributes(params)
          {
            status: params[:status],
            priority: params[:priority]
          }.compact
        end
      end
    end
  end
end
