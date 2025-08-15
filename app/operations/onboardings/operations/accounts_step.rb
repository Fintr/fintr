# frozen_string_literal: true

module Onboardings
  module Operations
    class AccountsStep < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
          required(:space_id).value(:string)

          required(:accounts).value(:array)
        end
      end

      def validate(params)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) if contract.failure?

        Success(contract.to_h)
      end

      def call(params)
        ActiveRecord::Base.transaction do
          params      = step validate(params)
          onboarding  = step find_onboarding(params)
          onboarding  = step update_onboarding(onboarding, params)
          _           = step create_accounts(onboarding, params)
          _           = step create_categories(onboarding, params)
          _           = step create_budgets(onboarding, params)
          _           = step create_income_transactions(onboarding, params)
          onboarding
        end
      end

      private

      def find_onboarding(params)
        onboarding = Onboarding.find_by(user_id: params[:user_id])
        return Failure("Onboarding not found") if onboarding.blank?

        Success(onboarding)
      end

      def update_onboarding(onboarding, params)
        accounts = params[:accounts].map do |account_hash|
          {
            name: account_hash[:name],
            balance: account_hash[:balance].to_s,
            account_category: account_hash[:account_category]
          }.stringify_keys
        end

        onboarding.update!(
          step: "completed",
          data: onboarding.data.merge(
            accounts:
          )
        )
        Success(onboarding)
      end

      def create_accounts(onboarding, params)
        accounts = params[:accounts].map do |account|
          step Transactions::Operations::Accounts::CreateAccount.new.call(
            **params,
            name: account[:name],
            balance: account[:balance].to_d,
            account_category: account[:account_category],
          )
        end
        Success(accounts)
      end

      def create_categories(onboarding, params)
        categories = onboarding.data["budgets"].map do |budget|
          step Transactions::Operations::Categories::CreateCategory.new.call(
            **params,
            name: budget["name"],
            category_type: "expense"
          )
        end
        Success(categories)
      end

      def create_budgets(onboarding, params)
        budgets = onboarding.data["budgets"].map do |budget|
          step Budgets::Operations::CreateBudget.new.call(
            **params,
            category_name: budget["name"],
            date: Date.current,
            amount: budget["amount"].to_d
          )
        end
        Success(budgets)
      end

      def create_income_transactions(onboarding, params)
        accounts = params[:accounts]
        salary = step Transactions::Operations::CreateTransaction.new.call(
          **params,
          category_name: "Salary",
          account_name: find_account_by_for(accounts, :for_salary),
          date: Date.current.beginning_of_month,
          amount: onboarding.data["income"]["salary_income"].to_d,
          remove_calculation: true,
          schedule_type: "repeat",
          repeat_interval: "every_month",
        )
        business = step Transactions::Operations::CreateTransaction.new.call(
          **params,
          category_name: "Business",
          account_name: find_account_by_for(accounts, :for_business),
          date: Date.current.beginning_of_month,
          amount: onboarding.data["income"]["business_income"].to_d,
          remove_calculation: true,
          schedule_type: "repeat",
          repeat_interval: "every_month",
        )
        Success(salary:, business:)
      end

      def find_account_by_for(accounts, for_type)
        accounts.find { |account| account[for_type] }[:name]
      end
    end
  end
end
