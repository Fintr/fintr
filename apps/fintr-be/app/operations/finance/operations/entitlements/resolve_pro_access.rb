# frozen_string_literal: true

module Finance
  module Operations
    module Entitlements
      class ResolveProAccess < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            optional(:user_id).maybe(:string)
            optional(:space_id).maybe(:string)
          end
        end

        def call(params)
          params = step validate(params)
          user = step find_user(params:)
          space = step find_space(params:)
          step resolve(user:, space:)
        end

        private

        def validate(params)
          result = Contract.new.call(params)
          return Failure(result.errors.to_h) if result.failure?
          return Failure(base: ["user or space is required"]) if result[:user_id].blank? && result[:space_id].blank?

          Success(result.to_h)
        end

        def find_user(params:)
          return Success(nil) if params[:user_id].blank?

          user = Auth::User.find_by(id: params[:user_id])
          return Failure(user_id: ["not found"]) unless user

          Success(user)
        end

        def find_space(params:)
          return Success(nil) if params[:space_id].blank?

          space = Spaces::Space.find_by(id: params[:space_id])
          return Failure(space_id: ["not found"]) unless space

          Success(space)
        end

        def resolve(user:, space:)
          revenuecat = user && Finance::RevenuecatCustomer.find_by(user_id: user.id)
          source = access_source(user:, space:, revenuecat:)

          Success(
            pro: source != "none",
            source:,
            app_user_id: user&.id,
            trial_ends_at: user&.trial_ends_at&.iso8601,
            trial_days_remaining: user&.trial_days_remaining.to_i,
            pro_expires_at: revenuecat&.pro_expires_at&.iso8601,
            features: Finance::ProFeatures::CATALOG,
          )
        end

        def access_source(user:, space:, revenuecat:)
          return "admin" if user&.has_role?(:admin)
          return "revenuecat" if revenuecat&.pro_current?
          return "subscription" if space_has_pro_subscription?(space:)
          return "trial" if user&.trial_active?

          "none"
        end

        def space_has_pro_subscription?(space:)
          return false unless space

          Finance::SpaceSubscription
            .where(space_id: space.id, subscription_type: %i[paid sponsor])
            .any? { |subscription| subscription.active? || subscription.in_grace_period? }
        end
      end
    end
  end
end
