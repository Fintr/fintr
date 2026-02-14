# frozen_string_literal: true

module Onboardings
  module Operations
    class ShowCurrencyData < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
          required(:space_id).value(:string)
        end
      end

      def validate(params)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h)
      end

      def call(params)
        params = step validate(params)
        onboarding = step find_onboarding(params)
        space = step find_space(params)
        step build_currency_response(onboarding:, space:)
      end

      private

      def find_onboarding(params)
        onboarding = Onboarding.find_by(user_id: params[:user_id])
        return Failure("Onboarding not found") if onboarding.blank?

        Success(onboarding)
      end

      def find_space(params)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(space_id: "not found") unless space

        Success(space)
      end

      def build_currency_response(onboarding:, space:)
        Success(
          currency: space.currency,
          stored_currency: onboarding.data["currency"]
        )
      end
    end
  end
end
