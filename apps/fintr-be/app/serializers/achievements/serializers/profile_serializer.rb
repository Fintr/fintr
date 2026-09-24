# frozen_string_literal: true

module Achievements
  module Serializers
    class ProfileSerializer
      def self.render_as_hash(profile)
        {
          xp: profile[:xp],
          level: profile[:level],
          xp_into_level: profile[:xp_into_level],
          xp_per_level: profile[:xp_per_level],
          title: profile[:title],
          titles: profile[:titles],
          featured: profile[:featured].map { |row| achievement_row(row) },
          achievements: profile[:achievements].map { |row| achievement_row(row) },
        }
      end

      def self.achievement_row(row)
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
      private_class_method :achievement_row
    end
  end
end
