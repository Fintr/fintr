# frozen_string_literal: true

module Achievements
  # Fire-and-forget unlock evaluation so product operations never fail on gamification errors.
  module EventHook
    module_function

    def evaluate(user_id:, event:, space_id: nil, context: {})
      return if user_id.blank?

      Achievements::Operations::EvaluateEvent.new.call(
        user_id:,
        event:,
        space_id:,
        context:,
      )
    rescue StandardError => e
      Rails.logger.warn("[Achievements::EventHook] #{e.class}: #{e.message}")
      nil
    end
  end
end
