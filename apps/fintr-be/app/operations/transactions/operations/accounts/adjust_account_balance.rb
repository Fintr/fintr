# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class AdjustAccountBalance < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:user_id).value(:string)
            required(:space_id).value(:string)
            required(:id).value(:string)
            required(:new_balance).value(:decimal)
            required(:adjustment_date).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params              = step validate(params:)
          params              = step parse_adjustment_date(params:)
          _                   = step find_user(params:)
          account             = step find_account(params:)
          adjustment_amount   = step calculate_adjustment(account:, params:)
          category            = step find_or_create_category(adjustment_amount:, params:)
          transaction         = step create_adjustment_transaction(account:, category:, adjustment_amount:, params:)

          transaction
        end

        private

        def parse_adjustment_date(params:)
          params[:adjustment_date] = Date.parse(params[:adjustment_date])
          Success(params)
        end

        def find_user(params:)
          user = Auth::User.find_by(id: params[:user_id])
          return Failure(user: "not found") unless user

          Success(user)
        end

        def find_account(params:)
          account = Transactions::Account.find(params[:id])
          Success(account)
        rescue ActiveRecord::RecordNotFound
          Failure(account: "not found")
        end

        def calculate_adjustment(account:, params:)
          current_balance = account.balance.to_f
          new_balance = params[:new_balance].to_f
          adjustment_amount = new_balance - current_balance

          Success(adjustment_amount)
        end

        def find_or_create_category(adjustment_amount:, params:)
          category_name = adjustment_amount >= 0 ? "Income Adjustment" : "Expense Adjustment"
          category_type = adjustment_amount >= 0 ? "income" : "expense"

          category = Transactions::Category.find_or_create_by!(
            name: category_name,
            space_id: params[:space_id],
            category_type: category_type
          )
          Success(category)
        rescue ActiveRecord::RecordInvalid => e
          Failure(category: "could not create #{category_name} category", error: e, expected: true)
        end

        def create_adjustment_transaction(account:, category:, adjustment_amount:, params:)
          transaction_params = {
            space_id: params[:space_id],
            user_id: params[:user_id],
            amount: adjustment_amount.abs,
            date: params[:adjustment_date],
            transaction_type: category.category_type,
            category_name: category.name,
            account_name: account.name,
            description: "Balance adjustment",
            schedule_type: "one_time",
            amount_in_currency: account.balance_currency
          }

          result = CreateTransaction.new.call(transaction_params)
          return result if result.success?

          Failure(transaction: "could not create adjustment transaction", error: result.failure)
        end
      end
    end
  end
end
