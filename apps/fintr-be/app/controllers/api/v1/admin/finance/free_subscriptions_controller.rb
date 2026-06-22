# frozen_string_literal: true

module Api
  module V1
    module Admin
      module Finance
        class FreeSubscriptionsController < ApiController
          skip_before_action :ensure_space_access!
          before_action :ensure_admin!

          # GET /admin/finance/free_subscriptions/spaces
          # List spaces with subscription status, ordered by transaction count (paginated)
          def spaces
            result = ::Admin::Queries::SpacesForFreeSubscriptionQuery.call(
              params: spaces_index_params,
            )

            return render_unprocessable_content(details: result.failure) unless result.success?

            render_paginated(
              result.value!,
              serializer: ::Admin::Serializers::SpaceForFreeSubscriptionSerializer,
              key: :spaces,
            )
          end

          # POST /admin/finance/free_subscriptions
          def create
            operation = ::Finance::Operations::Subscriptions::CreateFreeSubscription.new.call(
              space_id: free_subscription_params[:space_id],
              subscription_plan_id: free_subscription_params[:subscription_plan_id],
              granted_by: current_user.id.to_s,
              notes: free_subscription_params[:notes],
              anchor_date: free_subscription_params[:anchor_date]
            )

            return render_unprocessable_content(details: operation.failure) unless operation.success?

            subscription = operation.value!
            subscription_serializer = ::Finance::SpaceSubscriptionSerializer.render_as_hash(subscription)

            render_success(
              data: { subscription: subscription_serializer },
              status: :created,
              message: "Free subscription granted successfully"
            )
          end

          # DELETE /admin/finance/free_subscriptions/remove
          def remove
            operation = ::Finance::Operations::Subscriptions::RemoveFreeSubscription.new.call(
              space_id: remove_free_subscription_params[:space_id],
              removed_by: current_user.id.to_s
            )

            return render_unprocessable_content(details: operation.failure) unless operation.success?

            subscription = operation.value!
            subscription_serializer = ::Finance::SpaceSubscriptionSerializer.render_as_hash(subscription)

            render_success(
              data: { subscription: subscription_serializer },
              message: "Free subscription removed successfully"
            )
          end

          private

          def ensure_admin!
            return if current_user.has_role?(:admin)

            render_error(
              message: "Permission denied",
              status: :forbidden
            )
          end

          def free_subscription_params
            params.permit(
              :space_id,
              :subscription_plan_id,
              :notes,
              :anchor_date
            )
          end

          def remove_free_subscription_params
            params.permit(:space_id)
          end

          def spaces_index_params
            p = params.permit(
              :search_query,
              :page,
              :per_page,
            )
            {
              search_query: p[:search_query].presence,
              page: p[:page],
              per_page: p[:per_page].presence
            }
          end
        end
      end
    end
  end
end
