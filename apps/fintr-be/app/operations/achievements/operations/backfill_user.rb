# frozen_string_literal: true

module Achievements
  module Operations
    # Grants achievements existing users already qualify for (historical activity).
    # Idempotent: skips when +backfilled_at+ is set; safe to call from ShowProfile.
    class BackfillUser < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          optional(:force).value(:bool)
        end
      end

      def call(params)
        params = step validate(params:)
        step backfill(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def backfill(params:)
        user_id = params[:user_id]
        stats = Achievements::UserGamificationStat.find_or_initialize_by(user_id:)
        stats.xp ||= 0
        stats.level ||= 1

        space_ids = Spaces::SpaceUser
                      .where(user_id:)
                      .where.not(user_id: nil)
                      .distinct
                      .pluck(:space_id)

        unlocked = []

        Achievements::Achievement.active.find_each do |achievement|
          next if already_unlocked?(user_id:, achievement:)
          next unless qualifies?(
            achievement:,
            user_id:,
            space_ids:,
          )

          result = Achievements::Operations::UnlockAchievement.new.call(
            user_id:,
            achievement_key: achievement.key,
            space_id: space_ids.first,
            metadata: { source: "backfill" },
          )
          unlocked << result.value! if result.success?
        end

        stats = Achievements::UserGamificationStat.find_or_initialize_by(user_id:)
        stats.xp ||= 0
        stats.level = Achievements::UserGamificationStat.level_for_xp(xp: stats.xp.to_i)
        stats.backfilled_at = Time.current
        stats.save!

        Success(unlocked)
      end

      def already_unlocked?(user_id:, achievement:)
        Achievements::UserAchievement.exists?(
          user_id:,
          achievement_id: achievement.id,
        )
      end

      def qualifies?(achievement:, user_id:, space_ids:)
        Achievements::Qualifiers.met?(
          achievement:,
          user_id:,
          space_ids:,
        )
      end
    end
  end
end
