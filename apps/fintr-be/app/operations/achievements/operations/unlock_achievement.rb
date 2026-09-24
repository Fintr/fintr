# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Achievements
  module Operations
    class UnlockAchievement < Dry::Operation
      include Dry::Operation::Extensions::ActiveRecord

      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:achievement_key).filled(:string)
          optional(:space_id).maybe(:string)
          optional(:metadata).value(:hash)
        end
      end

      def call(params)
        params = step validate(params:)
        achievement = step find_achievement(params:)
        step ensure_not_already_unlocked(params:, achievement:)
        user_achievement = step create_user_achievement(
          params:,
          achievement:,
        )
        step award_xp(params:, achievement:)
        user_achievement
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def find_achievement(params:)
        achievement = Achievements::Achievement.active.find_by(key: params[:achievement_key])
        return Failure(achievement_key: "not found") unless achievement

        Success(achievement)
      end

      def ensure_not_already_unlocked(params:, achievement:)
        exists = Achievements::UserAchievement.exists?(
          user_id: params[:user_id],
          achievement_id: achievement.id,
        )
        return Failure(achievement_key: "already unlocked") if exists

        Success(true)
      end

      def create_user_achievement(params:, achievement:)
        record = Achievements::UserAchievement.create!(
          user_id: params[:user_id],
          achievement_id: achievement.id,
          space_id: params[:space_id],
          earned_at: Time.current,
          metadata: params[:metadata] || {},
        )
        Success(record)
      rescue ActiveRecord::RecordInvalid => e
        Failure(user_achievement: e.record.errors.to_h)
      end

      def award_xp(params:, achievement:)
        Achievements::Operations::AwardXp.new.call(
          user_id: params[:user_id],
          xp: achievement.xp_reward,
        )
      end
    end
  end
end
