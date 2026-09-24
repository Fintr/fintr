# frozen_string_literal: true

module Achievements
  module Operations
    class EvaluateEvent < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:event).filled(:string)
          optional(:space_id).maybe(:string)
          optional(:context).value(:hash)
        end
      end

      def call(params)
        params = step validate(params:)
        step unlock_matching(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def unlock_matching(params:)
        unlocked = []

        Achievements::Achievement.for_event(params[:event]).find_each do |achievement|
          next unless Achievements::Qualifiers.met?(
            achievement:,
            user_id: params[:user_id],
            space_id: params[:space_id],
          )

          result = Achievements::Operations::UnlockAchievement.new.call(
            user_id: params[:user_id],
            achievement_key: achievement.key,
            space_id: params[:space_id],
            metadata: params[:context] || {},
          )
          unlocked << result.value! if result.success?
        end

        Success(unlocked)
      end
    end
  end
end
