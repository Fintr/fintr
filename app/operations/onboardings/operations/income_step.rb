# frozen_string_literal: true

module Onboardings
  module Operations
    class IncomeStep < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
          required(:space_id).value(:string)

          required(:salary_income).value(:decimal)
          required(:business_income).value(:decimal)
        end
      end

      def validate(params)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h)
      end

      def call(params)
        ActiveRecord::Base.transaction do
          params     = step validate(params)
          onboarding = step find_or_create_onboarding(params[:user_id])
          onboarding = step store_income(onboarding, params)
          onboarding = step update_step(onboarding)
          { budgets_data: step(show_budget_setup(params)) }
        end
      end

      private

      def find_or_create_onboarding(user_id)
        user = Auth::User.find_by(id: user_id)
        return Failure(user_id: "User not found") if user.blank?

        return Success(user.onboarding) if user.onboarding.present?

        Success(Onboarding.create!(user: user, step: "income"))
      end

      def store_income(onboarding, params)
        onboarding.update!(
          data: onboarding.data.merge(
            "income" => {
              "salary_income" => params[:salary_income],
              "business_income" => params[:business_income]
            }
          )
        )

        Success(onboarding)
      end

      def update_step(onboarding)
        onboarding.update!(step: "budgets")
        Success(onboarding)
      end

      def show_budget_setup(params)
        Onboardings::Operations::ShowBudgetsData.new.call(user_id: params[:user_id])
      end
    end
  end
end
