# frozen_string_literal: true

module Onboardings
  module Operations
    class ShowAccountsData < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
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
        accounts_data = step show_accounts_setup
        account_categories = step show_account_categories
        salary_income = step salary_income_present?(onboarding)
        business_income = step business_income_present?(onboarding)

        { accounts_data:, account_categories:, salary_income:, business_income: }
      end

      private

      def find_onboarding(params)
        onboarding = Onboarding.find_by(user_id: params[:user_id])
        return Failure("Onboarding not found") if onboarding.blank?

        Success(onboarding)
      end

      def show_accounts_setup
        data = Transactions::Account::ACCOUNT_CATEGORY_LABELS.map do |value, label|
          { name: label, account_category: value, balance: 0 }
        end

        Success(data)
      end

      def show_account_categories
        Success(Transactions::Account.account_category_options)
      end

      def salary_income_present?(onboarding)
        Success(onboarding.data["income"]["salary_income"].to_d.round(2) > 0)
      end

      def business_income_present?(onboarding)
        Success(onboarding.data["income"]["business_income"].to_d.round(2) > 0)
      end
    end
  end
end
