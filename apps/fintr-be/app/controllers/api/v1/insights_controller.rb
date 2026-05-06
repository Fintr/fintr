# frozen_string_literal: true

module Api
  module V1
    class InsightsController < ApiController
      def index
        insights_data = Insights::Operations::CreateInsightsData.new.call(with_current_params(index_params))

        return render_internal_server_error(details: insights_data.failure) unless insights_data.success?

        render_success(data: insights_data.value!)
      end

      private

      def index_params
        params.permit(:category_name, :start_date, :end_date)
      end
    end
  end
end
