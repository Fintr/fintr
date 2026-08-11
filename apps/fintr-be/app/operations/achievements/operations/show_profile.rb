# frozen_string_literal: true

module Achievements
  module Operations
    class ShowProfile < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          optional(:space_id).maybe(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        step ensure_backfilled(params:)
        step build_profile(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def ensure_backfilled(params:)
        Achievements::Operations::BackfillUser.new.call(
          user_id: params[:user_id],
        )
        Success(true)
      rescue StandardError => e
        Rails.logger.warn("[Achievements::ShowProfile] backfill failed: #{e.message}")
        Success(true)
      end

      def build_profile(params:)
        stats = Achievements::UserGamificationStat.find_or_initialize_by(
          user_id: params[:user_id],
        )
        stats.xp ||= 0
        stats.level ||= 1

        achievements = step ListUserAchievements.new.call(user_id: params[:user_id])
        earned = achievements.select { |row| row[:earned] }.first(8)
        title = Achievements::LevelTitles.for_level(level: stats.level)
        titles = Achievements::LevelTitles.ladder_for(level: stats.level)

        Success(
          xp: stats.xp,
          level: stats.level,
          xp_into_level: stats.persisted? ? stats.xp_into_level : 0,
          xp_per_level: Achievements::UserGamificationStat::XP_PER_LEVEL,
          title:,
          titles:,
          featured: earned,
          achievements:,
        )
      end
    end
  end
end
