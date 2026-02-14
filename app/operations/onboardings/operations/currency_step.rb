# frozen_string_literal: true

module Onboardings
  module Operations
    class CurrencyStep < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
          required(:space_id).value(:string)
          required(:currency).value(:string)
        end

        rule(:currency) do
          key.failure("must be a 3-letter ISO currency code (e.g. USD, PHP)") unless value.to_s.match?(/\A[A-Za-z]{3}\z/)
        end
      end

      def validate(params)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h.merge(currency: contract.to_h[:currency].to_s.upcase))
      end

      include FailureHandler
      require "dry/operation/extensions/active_record"
      include Dry::Operation::Extensions::ActiveRecord

      def call(params)
        params = step validate(params)
        onboarding = step find_onboarding(params)
        space = step find_space(params)
        transaction do
          step update_space_currency(space:, currency: params[:currency])
          step update_onboarding_step(onboarding:, params:)
        end
        { income_data: step(show_income_setup(params)) }
      end

      private

      def find_onboarding(params)
        onboarding = Onboarding.find_by(user_id: params[:user_id])
        return Failure(error: "Onboarding not found") if onboarding.blank?

        Success(onboarding)
      end

      def find_space(params)
        space = Spaces::Space.find_by(id: params[:space_id])
        return Failure(space_id: "not found") unless space

        Success(space)
      end

      def update_space_currency(space:, currency:)
        space.update!(currency: currency)
        Success(space)
      end

      def update_onboarding_step(onboarding:, params:)
        onboarding.update!(
          step: "income",
          data: onboarding.data.merge("currency" => params[:currency])
        )
        Success(onboarding)
      end

      def show_income_setup(params)
        Onboardings::Operations::ShowIncomeData.new.call(user_id: params[:user_id])
      end
    end
  end
end
