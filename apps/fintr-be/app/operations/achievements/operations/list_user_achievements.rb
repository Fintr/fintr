# frozen_string_literal: true

module Achievements
  module Operations
    class ListUserAchievements < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        step load_achievements(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def load_achievements(params:)
        earned = Achievements::UserAchievement
                   .includes(:achievement)
                   .where(user_id: params[:user_id])
                   .order(earned_at: :desc)

        catalog = Achievements::Achievement.active.ordered
        earned_by_key = earned.index_by { |ua| ua.achievement.key }

        rows = catalog.map do |achievement|
          user_achievement = earned_by_key[achievement.key]
          {
            achievement:,
            earned: user_achievement.present?,
            earned_at: user_achievement&.earned_at,
            space_id: user_achievement&.space_id,
          }
        end

        Success(rows)
      end
    end
  end
end
