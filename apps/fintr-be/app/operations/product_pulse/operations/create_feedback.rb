# frozen_string_literal: true

module ProductPulse
  module Operations
    class CreateFeedback < Dry::Operation
      # Mirrors frontend weekly pulse chips — keep lists aligned
      ALLOWED_AREA_IDS = %w[
        transactions
        budgets
        loans
        insights
        ai_assistant
        subscriptions
        settings
        mobile_experience
        speed
        visual_design
      ].freeze

      class Contract < Dry::Validation::Contract
        option :allowed_area_ids,
               default: -> { CreateFeedback::ALLOWED_AREA_IDS }

        params do
          required(:user_id).filled(:string)
          required(:space_id).filled(:string)
          optional(:liked_areas).value(:array).each(:string)
          optional(:improve_areas).value(:array).each(:string)
          optional(:notes).maybe(:string)
        end

        rule(:notes) do
          next unless key?

          key.failure("must be at most 2000 characters") if value.present? && value.length > 2000
        end

        rule(:liked_areas, :improve_areas, :notes) do
          likes = values[:liked_areas].presence || []
          improves = values[:improve_areas].presence || []
          notes = values[:notes].to_s.strip
          next if likes.any? || improves.any? || notes.present?

          base.failure("need at least one like, one improvement area, or notes")
        end

        rule(:liked_areas) do
          next unless key?

          invalid = value - allowed_area_ids
          key.failure("contains unknown ids: #{invalid.join(', ')}") if invalid.any?
        end

        rule(:improve_areas) do
          next unless key?

          invalid = value - allowed_area_ids
          key.failure("contains unknown ids: #{invalid.join(', ')}") if invalid.any?
        end
      end

      def call(params)
        validated = step validate(params:)
        validated = step verify_space_membership(validated:)
        validated = step attach_period_key(validated:)
        record = step build_feedback(validated:)
        step persist_feedback(record:)
      end

      private

      def verify_space_membership(validated:)
        unless Spaces::SpaceUser.exists?(
                 user_id: validated[:user_id],
                 space_id: validated[:space_id]
               )
          return Failure(space_id: ["not accessible"])
        end

        Success(validated)
      end

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def attach_period_key(validated:)
        Success(
          validated.merge(period_key: Time.zone.today.strftime("%G-W%V"))
        )
      end

      def build_feedback(validated:)
        feedback = ProductPulseFeedback.new(
          user_id: validated[:user_id],
          space_id: validated[:space_id],
          period_key: validated[:period_key],
          liked_areas: validated[:liked_areas].presence || [],
          improve_areas: validated[:improve_areas].presence || [],
          notes: validated[:notes].presence
        )

        Success(feedback)
      end

      def persist_feedback(record:)
        record.save!

        Success(record)
      rescue ActiveRecord::RecordNotUnique
        Failure(
          period_key: ["feedback for this week was already submitted"]
        )
      rescue ActiveRecord::RecordInvalid
        Failure(record.errors.to_hash)
      end
    end
  end
end
