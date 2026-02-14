# frozen_string_literal: true

module Budgets
  module Operations
    class CreateBudget < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:category_name).value(:string)
          required(:space_id).value(:string)
          required(:amount).value(:integer)
          required(:date).value(:date)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params   = step validate(params:)
        category = step find_category(params:)
        params   = step update_params(params:, category:)
        budget   = step create_budget(params:)
        budget.reload
      end

      def find_category(params:)
        category = Transactions::Category.find_by!(space_id: params[:space_id], name: params[:category_name])
        Success(category)
      rescue ActiveRecord::RecordNotFound
        Failure(category_name: "not found")
      end

      def update_params(params:, category:)
        space = Spaces::Space.find_by(id: params[:space_id])
        params[:category_id] = category.id
        params[:amount_cents] = params[:amount] * 100
        params[:amount_currency] = space&.currency.presence || "PHP"
        Success(params)
      rescue StandardError
        Failure(:params_error)
      end

      def create_budget(params:)
        budget = Budget.new
        budget.assign_attributes(**params.slice(:space_id, :category_id, :amount_cents, :amount_currency, :date))
        budget.save!
        Success(budget)
      rescue StandardError
        Failure(**budget.errors.to_hash)
      end
    end
  end
end
