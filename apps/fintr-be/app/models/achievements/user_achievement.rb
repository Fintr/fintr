# frozen_string_literal: true

module Achievements
  class UserAchievement < ApplicationRecord
    self.table_name = "user_achievements"

    belongs_to :user, class_name: "Auth::User"
    belongs_to :achievement, class_name: "Achievements::Achievement"
    belongs_to :space, class_name: "Spaces::Space", optional: true

    validates :earned_at, presence: true
    validates :achievement_id, uniqueness: { scope: :user_id }
  end
end
