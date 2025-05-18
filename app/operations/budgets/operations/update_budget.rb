# frozen_string_literal: true

module Budgets
  module Operations
    class UpdateBudget < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:id).value(:string)
          required(:space_id).value(:string)
          required(:amount).value(:integer)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params = step validate(params:)
        budget = step find_budget(params:)
        budget = step validate_budget(budget:, params:)
        params = step update_params(params:)
        budget = step update_budget(budget:, params:)
        budget.reload
      end

      def find_budget(params:)
        budget = Budget.find(params[:id])
        Success(budget)
      rescue ActiveRecord::RecordNotFound
        Failure(id: "not found")
      end

      def validate_budget(budget:, params:)
        return Failure(id: "budget not for workspace") unless budget.space_id == params[:space_id]

        Success(budget)
      end

      def update_params(params:)
        params[:amount_cents] = params[:amount] * 100
        params[:amount_currency] = "PHP"
        Success(params)
      rescue StandardError
        Failure(:params_error)
      end

      def update_budget(budget:, params:)
        budget.assign_attributes(**params.slice(:amount_cents, :amount_currency))
        budget.save!
        Success(budget)
      rescue StandardError
        Failure(**budget.errors.to_hash)
      end
    end
  end
end
