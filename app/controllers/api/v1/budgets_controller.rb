# frozen_string_literal: true

module Api
  module V1
    class BudgetsController < ApiController
      def index
        operation = Budgets::Operations::PrepareMonthlyReport.new.call(index_params)
        return render_internal_server_error(details: operation.failure) unless operation.success?

        render_success(
          data: operation.value!
        )
      end

      private

      def index_params
        params.permit(:space_code, :date)
      end
    end
  end
end
