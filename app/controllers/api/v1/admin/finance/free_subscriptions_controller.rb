# frozen_string_literal: true

module Api
  module V1
    module Admin
      module Finance
        class FreeSubscriptionsController < ApiController
          skip_before_action :ensure_space_access!
          before_action :ensure_admin!

          # GET /admin/finance/free_subscriptions/spaces
          # List all spaces with their current subscription status
          def spaces
            spaces = ::Spaces::Space.includes(:owner, :space_subscriptions).order(created_at: :desc)

            serializer = spaces.map do |space|
              active_subscription = space.space_subscriptions.find { |s| s.status == "active" }

              {
                id: space.id,
                name: space.name,
                code: space.code,
                type: space.type == "Spaces::PersonalSpace" ? "Personal" : "Organization",
                currency: space.currency,
                ownerEmail: space.owner&.email,
                ownerName: space.owner&.full_name,
                hasActiveSubscription: active_subscription.present?,
                subscriptionStatus: active_subscription&.status,
                subscriptionType: active_subscription&.subscription_type,
                createdAt: space.created_at.iso8601
              }
            end

            render_success(data: { spaces: serializer })
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
        end
      end
    end
  end
end
