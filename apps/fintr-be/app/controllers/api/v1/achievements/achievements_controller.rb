# frozen_string_literal: true

module Api
  module V1
    module Achievements
      class AchievementsController < ApiController
        def index
          operation = ::Achievements::Operations::ListUserAchievements.new.call(
            user_id: current_user.id,
          )
          return render_unprocessable_content(details: operation.failure) unless operation.success?

          rows = operation.value!.map do |row|
            achievement = row[:achievement]
            {
              key: achievement.key,
              title: achievement.title,
              description: achievement.description,
              xp_reward: achievement.xp_reward,
              rarity: achievement.rarity,
              kind: achievement.kind,
              category: achievement.category,
              position: achievement.position,
              image_key: achievement.image_key,
              unlock_event: achievement.unlock_event,
              earned: row[:earned],
              earned_at: row[:earned_at],
              space_id: row[:space_id],
            }
          end

          render_success(data: { achievements: rows })
        end
      end
    end
  end
end
