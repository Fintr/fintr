# frozen_string_literal: true

module Insights
  module Operations
    class ResolveContext < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          required(:space_code).value(:string)
          required(:start_date).value(:date)
          required(:end_date).value(:date)
          optional(:category_name).maybe(:string)
          optional(:category_id).maybe(:string)
          optional(:subcategory_id).maybe(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        space = step find_space(params:)
        transactions = step find_transactions(params:)
        prior_transactions = step find_prior_transactions(params:)
        budgets = step find_budgets(params:)
        budget_records = step find_budget_records(space:, params:)
        step build_context(
          params:,
          space:,
          transactions:,
          prior_transactions:,
          budgets:,
          budget_records:
        )
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def find_space(params:)
        space = Spaces::Space.find_by(code: params[:space_code])
        return Failure(space_code: "Not found") if space.blank?

        Success(space)
      end

      def find_transactions(params:)
        filtered_transactions(params:)
      end

      def find_prior_transactions(params:)
        period_days = (params[:end_date] - params[:start_date]).to_i + 1
        prior_end = params[:start_date] - 1.day
        prior_start = prior_end - (period_days - 1).days

        prior_params = params.merge(
          start_date: prior_start,
          end_date: prior_end
        )
        filtered_transactions(params: prior_params)
      end

      def find_budgets(params:)
        Budgets::Queries::MonthlyBudgets.call(
          params: {
            space_code: params[:space_code],
            start_date: params[:start_date],
            end_date: params[:end_date]
          }
        )
      end

      def find_budget_records(space:, params:)
        start_month = params[:start_date].to_date.beginning_of_month
        end_month = params[:end_date].to_date.end_of_month
        records = Budget.where(space_id: space.id, date: start_month..end_month).to_a
        Success(records)
      end

      def build_context(params:, space:, transactions:, prior_transactions:, budgets:, budget_records:)
        period_days = (params[:end_date] - params[:start_date]).to_i + 1

        Success(
          space:,
          transactions:,
          prior_transactions:,
          budgets:,
          budget_records:,
          is_business: space.is_a?(Spaces::OrganizationSpace),
          start_date: params[:start_date],
          end_date: params[:end_date],
          period_days:,
          category_filtered: category_filtered?(params:)
        )
      end

      def category_filtered?(params:)
        params[:category_id].present? ||
          (params[:category_name].present? && !["all", ""].include?(params[:category_name]))
      end

      def filtered_transactions(params:)
        params_for_calculated_transactions = params.merge(
          balance_state: "calculated",
          paginate: false,
          without_initial_balance: true
        )
        result = Transactions::Queries::FilteredTransactions.call(
          params: params_for_calculated_transactions
        )
        return result unless result.success?

        Success(result.value!)
      end
    end
  end
end
