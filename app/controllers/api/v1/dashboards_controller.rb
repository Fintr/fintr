# frozen_string_literal: true

module Api
  module V1
    class DashboardsController < ApiController
      def show
        query = Spaces::Queries::DashboardData.call(params: show_params)

        return render_internal_server_error(details: query.failure) unless query.success?

        render_single(
          query.value!,
          serializer: Spaces::Serializers::DashboardSerializer,
          key: :dashboard
        )
      end

      private

      def show_params
        { space_code: current_space.code }
      end
    end
  end
end
