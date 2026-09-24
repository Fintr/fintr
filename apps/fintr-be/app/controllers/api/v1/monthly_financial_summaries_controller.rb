# frozen_string_literal: true

module Api
  module V1
    class MonthlyFinancialSummariesController < ApiController
      def index
        operation = ::MonthlyFinancialSummaries::Operations::ListForSpace.new.call(
          with_current_params(index_params)
        )

        return render_unprocessable_content(details: operation.failure) unless operation.success?

        render_success(
          data: {
            monthly_financial_summaries:
              ::MonthlyFinancialSummaries::Serializers::MonthlyFinancialSummarySerializer.render_as_hash(
                operation.value!
              )
          }
        )
      end

      private

      def index_params
        params.permit(:start_date, :end_date).to_h
      end
    end
  end
end
