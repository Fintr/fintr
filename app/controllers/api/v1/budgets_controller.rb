# frozen_string_literal: true

module Api
  module V1
    class BudgetsController < ApiController
      def index
        operation = Budgets::Operations::PrepareMonthlyReport.new.call(index_params)
        return render_unprocessable_entity(details: operation.failure) unless operation.success?

        render_success(data: operation.value!)
      end

      def create
        operation = Budgets::Operations::CreateBudget.new.call(with_current_params(create_params))
        return render_unprocessable_entity(details: operation.failure) unless operation.success?

        render_created(record: operation.value!)
      end

      def update
        operation = Budgets::Operations::UpdateBudget.new.call(with_current_params(update_params))
        return render_unprocessable_entity(details: operation.failure) unless operation.success?

        render_created(record: operation.value!)
      end

      def destroy
        budget = Budget.find_by(id: params[:id], space: current_space)
        return render_not_found(details: "Budget not found") if budget.blank?

        budget.destroy
        render_success(message: "Budget deleted successfully")
      end

      private

      def index_params
        params.permit(:space_code, :date)
      end

      def create_params
        params.permit(:category_name, :space_id, :amount, :date)
      end

      def update_params
        params.permit(:id, :amount)
      end
    end
  end
end
