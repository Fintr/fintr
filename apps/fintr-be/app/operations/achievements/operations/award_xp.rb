# frozen_string_literal: true

module Achievements
  module Operations
    class AwardXp < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).filled(:string)
          required(:xp).filled(:integer, gteq?: 0)
        end
      end

      def call(params)
        params = step validate(params:)
        step apply_xp(params:)
      end

      private

      def validate(params:)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def apply_xp(params:)
        stats = Achievements::UserGamificationStat.find_or_initialize_by(
          user_id: params[:user_id],
        )
        stats.xp = stats.xp.to_i + params[:xp]
        stats.level = Achievements::UserGamificationStat.level_for_xp(xp: stats.xp)
        stats.save!
        Success(stats)
      rescue ActiveRecord::RecordInvalid => e
        Failure(gamification: e.record.errors.to_h)
      end
    end
  end
end
