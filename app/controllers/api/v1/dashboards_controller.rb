# frozen_string_literal: true

module Api
  module V1
    class DashboardsController < ApiController
      def show
        operation = Dashboards::Operations::ShowDashboardData.new.call(show_params)

        return render_internal_server_error(details: operation.failure) unless operation.success?

        render_success(data: { dashboard: operation.value! })
      end

      def reset_data
        operation = Spaces::Operations::ResetData.new.call(with_current_params)
        return render_unprocessable_content(details: operation.failure) unless operation.success?

        render_success(data: operation.value!)
      end

      private

      def show_params
        { space_code: current_space.code }
      end
    end
  end
end
