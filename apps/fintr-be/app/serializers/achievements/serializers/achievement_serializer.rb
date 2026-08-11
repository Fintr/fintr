# frozen_string_literal: true

module Achievements
  module Serializers
    class AchievementSerializer < Blueprinter::Base
      identifier :id

      fields :key,
             :title,
             :description,
             :xp_reward,
             :rarity,
             :kind,
             :category,
             :position,
             :image_key,
             :unlock_event
    end
  end
end
