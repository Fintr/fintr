# frozen_string_literal: true

module Api
  module V1
    class OnboardingsController < ApiController
      skip_before_action :ensure_space_access!
      before_action :set_onboarding_space

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
        when "currency"
          currency_params
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

      def currency_params
        params.permit(
          :step,
          :currency
        )
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

      # Use the current user's personal space for onboarding (no X-Space-Code required).
      # Ensures new users can complete step 1 before the frontend has set the space code.
      def set_onboarding_space
        personal_space = current_user.personal_spaces.first
        return if personal_space.blank?

        @current_space = personal_space
      end
    end
  end
end
