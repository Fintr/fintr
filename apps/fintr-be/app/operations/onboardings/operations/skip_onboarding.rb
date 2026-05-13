# frozen_string_literal: true

module Onboardings
  module Operations
    class SkipOnboarding < Dry::Operation
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

      include FailureHandler

      def call(params)
        ActiveRecord::Base.transaction do
          params     = step validate(params)
          onboarding = step find_onboarding(params)
          onboarding = step store_default_budgets(onboarding)
          _          = step create_default_categories(params)
          _          = step create_default_budgets(params)
          _          = step create_default_account(params)
          _          = step complete_onboarding(onboarding)
        end
        Success({})
      end

      private

      def find_onboarding(params)
        onboarding = Onboarding.find_by(user_id: params[:user_id])
        return Failure(error: "Onboarding not found") if onboarding.blank?

        Success(onboarding)
      end

      def store_default_budgets(onboarding)
        default_budgets = Transactions::Category::DEFAULT_EXPENSE_CATEGORIES.map do |name|
          { "name" => name, "amount" => "0" }
        end

        onboarding.update!(
          data: onboarding.data.merge("budgets" => default_budgets)
        )
        Success(onboarding)
      end

      def create_default_categories(params)
        Transactions::Category::DEFAULT_EXPENSE_CATEGORIES.each do |name|
          step Transactions::Operations::Categories::CreateCategory.new.call(
            **params,
            name: name,
            category_type: "expense"
          )
        end
        Success(nil)
      end

      def create_default_budgets(params)
        Transactions::Category::DEFAULT_EXPENSE_CATEGORIES.each do |name|
          step Budgets::Operations::CreateBudget.new.call(
            **params,
            category_name: name,
            date: Date.current,
            amount: 0.to_d
          )
        end
        Success(nil)
      end

      def create_default_account(params)
        Transactions::Account::DEFAULT_ACCOUNT_MAPPING.each do |category_key, account_name|
          step Transactions::Operations::Accounts::CreateAccount.new.call(
            user_id: params[:user_id],
            space_id: params[:space_id],
            name: account_name,
            balance: 0.to_d,
            account_category: Transactions::Account.account_categories[category_key.to_s]
          )
        end
        Success(nil)
      end

      def complete_onboarding(onboarding)
        onboarding.update!(step: "completed")
        Success(onboarding)
      end
    end
  end
end
