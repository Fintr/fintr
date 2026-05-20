# frozen_string_literal: true

module Budgets
  module Operations
    class CreateBudget < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          optional(:category_name).maybe(:string)
          optional(:category_id).maybe(:string)
          optional(:subcategory_id).maybe(:string)
          required(:space_id).value(:string)
          required(:amount).value(:integer)
          required(:date).value(:date)
        end

        rule(:category_name, :category_id) do
          if values[:category_name].blank? && values[:category_id].blank?
            key(:category_id).failure("category_id or category_name is required")
          end
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params      = step validate(params:)
        assignment  = step resolve_category_ids(params:)
        params      = params.merge(assignment)
        _           = step validate_allocation(params:)
        params      = step update_params(params:)
        budget      = step create_budget(params:)
        budget.reload
      end

      private

      def resolve_category_ids(params:)
        if params[:category_id].present?
          return Transactions::Operations::ResolveCategoryAssignment.new.call(
            space_id: params[:space_id],
            category_id: params[:category_id],
            subcategory_id: params[:subcategory_id]
          )
        end

        category = Transactions::Category.find_by!(
          space_id: params[:space_id],
          name: params[:category_name]
        )
        Success(
          category_id: category.id,
          subcategory_id: nil
        )
      rescue ActiveRecord::RecordNotFound
        Failure(category_name: "not found")
      end

      def validate_allocation(params:)
        ValidateCategoryBudgetAllocation.new.call(
          space_id: params[:space_id],
          category_id: params[:category_id],
          subcategory_id: params[:subcategory_id],
          date: params[:date],
          amount: params[:amount]
        )
      end

      def update_params(params:)
        space = Spaces::Space.find_by(id: params[:space_id])
        params[:amount_cents] = params[:amount] * 100
        params[:amount_currency] = space&.currency.presence || "PHP"
        Success(params)
      rescue StandardError
        Failure(:params_error)
      end

      def create_budget(params:)
        budget = Budget.new
        budget.assign_attributes(
          **params.slice(:space_id, :category_id, :subcategory_id, :amount_cents, :amount_currency, :date)
        )
        budget.save!
        Success(budget)
      rescue StandardError
        Failure(**budget.errors.to_hash)
      end
    end
  end
end
