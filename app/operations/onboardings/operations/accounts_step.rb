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

      include FailureHandler

      def call(params)
        ActiveRecord::Base.transaction do
          params      = step validate(params)
          onboarding  = step find_onboarding(params)
          _           = step validate_data(onboarding, params)
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
        return Failure(error: "Onboarding not found") if onboarding.blank?

        Success(onboarding)
      end

      def validate_data(onboarding, params)
        accounts = params[:accounts]
        salary_account_name = find_account_by_for(accounts, :for_salary)
        business_account_name = find_account_by_for(accounts, :for_business)

        salary_error = if has_income?(onboarding, :salary_income) && salary_account_name.blank?
          "Salary account is required"
        end

        business_error = if has_income?(onboarding, :business_income) && business_account_name.blank?
          "Business account is required"
        end

        return Failure(salary_error:, business_error:) if salary_error.present? || business_error.present?

        Success(params)
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
        salary_account_name = find_account_by_for(accounts, :for_salary)
        if salary_account_name.present?
          salary = step Transactions::Operations::CreateTransaction.new.call(
            **params,
            category_name: "Salary",
            account_name: salary_account_name,
            date: Date.current.beginning_of_month,
            amount: onboarding.data["income"]["salary_income"].to_d,
            skip_calculation: true,
            schedule_type: "repeat",
            repeat_interval: "every_month",
          )
        end

        business_account_name = find_account_by_for(accounts, :for_business)
        if business_account_name.present?
          business = step Transactions::Operations::CreateTransaction.new.call(
            **params,
            category_name: "Business",
            account_name: business_account_name,
            date: Date.current.beginning_of_month,
            amount: onboarding.data["income"]["business_income"].to_d,
            skip_calculation: true,
            schedule_type: "repeat",
            repeat_interval: "every_month",
          )
        end
        Success(salary:, business:)
      end

      def find_account_by_for(accounts, for_type)
        accounts.find { |account| account[for_type] }&.dig(:name)
      end

      def has_income?(onboarding, income_type)
        onboarding.data.with_indifferent_access["income"][income_type].to_d.round(2) > 0
      end
    end
  end
end
