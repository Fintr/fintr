# frozen_string_literal: true

module Api
  module V1
    module Admin
      class UserActivityController < ApiController
        def analytics
          operation = ::Admin::Operations::CreateUserActivityAnalytics.new.call(analytics_params)

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(
            data: operation.value!
          )
        end

        def daily_active_users
          query = ::Admin::Queries::DailyActiveUsersQuery.new(params: daily_active_users_params)
          result = query.call

          return render_unprocessable_content(details: result.failure) unless result.success?

          render_success(
            data: result.value!
          )
        end

        private

        def analytics_params
          params.permit(
            :start_date,
            :end_date,
            :group_by
          ).to_h
        end

        def daily_active_users_params
          params.permit(
            :start_date,
            :end_date,
            :group_by
          ).to_h
        end
      end
    end
  end
end
