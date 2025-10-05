# frozen_string_literal: true

module Api
  module V1
    class OnboardingsController < ApiController
      def create
        params = { **with_current_params(create_params), action: "create" }.with_indifferent_access
        operation = Onboardings::Operations::DelegateStep.new.call(params)

        return render_internal_server_error(details: operation.failure) unless operation.success?

        render_success(data: operation.value!)
      end

      def show
        params = { **with_current_params(show_params), action: "show" }.with_indifferent_access
        operation = Onboardings::Operations::DelegateStep.new.call(params)

        return render_internal_server_error(details: operation.failure) unless operation.success?

        render_success(data: operation.value!)
      end

      private

      def create_params
        case params[:step]
        when "income"
          income_params
        when "budgets"
          budgets_params
        when "accounts"
          accounts_params
        end
      end

      def show_params
        show_step_params
      end

      def income_params
        params.permit(
          :step,
          :income
        )
      end

      def budgets_params
        params.permit(
          :step,
          budget_categories: [:name, :amount]
        )
      end

      def accounts_params
        params.permit(
          :step,
          accounts: [:name, :account_category, :balance]
        )
      end

      def show_step_params
        params.permit(:step)
      end
    end
  end
end
