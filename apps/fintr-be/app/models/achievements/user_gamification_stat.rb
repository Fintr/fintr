# frozen_string_literal: true

module Achievements
  class UserGamificationStat < ApplicationRecord
    self.table_name = "user_gamification_stats"

    XP_PER_LEVEL = 100

    belongs_to :user, class_name: "Auth::User"

    validates :xp, numericality: { greater_than_or_equal_to: 0 }
    validates :level, numericality: { greater_than_or_equal_to: 1 }
    validates :user_id, uniqueness: true

    def self.level_for_xp(xp:)
      [ (xp / XP_PER_LEVEL).floor + 1, 1 ].max
    end

    def xp_into_level
      xp % XP_PER_LEVEL
    end

    def xp_to_next_level
      XP_PER_LEVEL - xp_into_level
    end
  end
end
