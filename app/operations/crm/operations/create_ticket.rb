# frozen_string_literal: true

module Crm
  module Operations
    class CreateTicket < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:space_id).filled(:string)
          required(:title).filled(:string)
          required(:description).filled(:string)
          required(:ticket_type).filled(:string)
          optional(:priority).filled(:string)
          optional(:images).value(:array)
        end

        rule(:title) do
          key.failure("must be at most 255 characters") if value.length > 255
        end

        rule(:description) do
          key.failure("must be at most 2000 characters") if value.length > 2000
        end

        rule(:ticket_type) do
          valid_types = %w[bug_report feature_request general_feedback help_request billing_issue account_issue other]
          key.failure("must be one of: #{valid_types.join(', ')}") unless valid_types.include?(value)
        end

        rule(:priority) do
          if key?
            valid_priorities = %w[low medium high urgent]
            key.failure("must be one of: #{valid_priorities.join(', ')}") unless valid_priorities.include?(value)
          end
        end
      end

      def validate(params)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end


      def call(params)
        ticket, validated_params = ActiveRecord::Base.transaction do
          validated_params = step validate(params)
          ticket = step build_ticket(validated_params)
          step save_ticket(ticket)
          [ticket, validated_params]
        end
        _ = step attach_images(ticket, validated_params[:images]) if validated_params[:images].present?
        ticket
      end

      private


      def build_ticket(params)
        ticket = Crm::Ticket.new(
          space_id: params[:space_id],
          user_id: params[:user_id],
          title: params[:title],
          description: params[:description],
          ticket_type: params[:ticket_type],
          priority: params[:priority] || "medium",
          status: "open"
        )

        Success(ticket)
      end

      def attach_images(ticket, images)
        # Filter out empty or invalid images
        valid_images = images.compact.select { |image| image.present? && valid_image?(image) }

        if valid_images.any?
          ticket.images.attach(valid_images)
        end

        Success(ticket)
      end

      def save_ticket(ticket)
        return Failure(ticket.errors.full_messages) unless ticket.valid?

        ActiveRecord::Base.transaction do
          ticket.save!
        end

        Success(ticket)
      rescue StandardError => e
        Rails.logger.error("CreateTicket error: #{e.message}")
        Failure([e.message])
      end

      def valid_image?(image)
        return false unless image.respond_to?(:content_type)

        allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp"]
        max_size = 10.megabytes

        allowed_types.include?(image.content_type) && image.size <= max_size
      end
    end
  end
end
