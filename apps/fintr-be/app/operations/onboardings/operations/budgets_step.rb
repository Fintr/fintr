# frozen_string_literal: true

module Onboardings
  module Operations
    class BudgetsStep < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
          required(:space_id).value(:string)

          required(:budget_categories).value(:array)
        end
      end

      def validate(params)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h)
      end

      def call(params)
        ActiveRecord::Base.transaction do
          params        = step validate(params)
          onboarding    = step find_onboarding(params[:user_id])
          onboarding    = step store_budgets(onboarding, params)
          onboarding    = step update_step(onboarding)
          accounts_data = step show_accounts_setup(onboarding)
          accounts_data
        end
      end

      private

      def find_onboarding(user_id)
        user = Auth::User.find_by(id: user_id)
        return Failure(user_id: "User not found") if user.blank?

        return Failure(user_id: "Onboarding not found") if user.onboarding.blank?

        Success(user.onboarding)
      end

      def store_budgets(onboarding, params)
        onboarding.update!(
          data: onboarding.data.merge(
            "budgets" => params[:budget_categories].map(&:deep_stringify_keys)
          )
        )

        Success(onboarding)
      end

      def update_step(onboarding)
        onboarding.update!(step: "accounts")
        Success(onboarding)
      end

      def show_accounts_setup(params)
        Onboardings::Operations::ShowAccountsData.new.call(user_id: params[:user_id])
      end
    end
  end
end
