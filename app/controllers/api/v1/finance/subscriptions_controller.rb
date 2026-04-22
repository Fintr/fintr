# frozen_string_literal: true

module Api
  module V1
    module Finance
      class SubscriptionsController < ApiController
        def index
          query_result = ::Finance::Queries::ListSubscriptionPlans.call

          return render_unprocessable_content(details: query_result.failure) unless query_result.success?

          plans = query_result.value!
          serializer = plans.map do |plan|
            ::Finance::SubscriptionPlanSerializer.render_as_hash(plan)
          end

          render_success(data: { subscription_plans: serializer })
        end

        def current_subscriptions
          operation = ::Finance::Operations::Subscriptions::GetCurrentSubscriptions.new.call(
            with_current_params(space_id: current_space.id.to_s)
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          subscriptions = operation.value!
          if subscriptions.present?
            serializer = subscriptions.map do |subscription|
              ::Finance::SpaceSubscriptionSerializer.render_as_hash(subscription)
            end
            render_success(data: { subscriptions: serializer })
          else
            render_success(data: { subscriptions: [] })
          end
        end

        def create
          operation = ::Finance::Operations::Subscriptions::CreateSubscription.new.call(
            with_current_params(create_params)
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          result = operation.value!
          subscription_serializer = ::Finance::SpaceSubscriptionSerializer.render_as_hash(
            result[:space_subscription]
          )

          # Use render_success directly to include all data (action_url, status, subscription)
          render_success(
            data: {
              subscription: subscription_serializer,
              action_url: result[:action_url],
              status: result[:status]
            },
            status: :created,
            message: "Subscription created successfully"
          )
        end

        def update
          operation = ::Finance::Operations::Subscriptions::UpdateSubscription.new.call(
            space_id: current_space.id.to_s,
            subscription_id: params[:id],
            new_subscription_plan_id: update_params[:subscription_plan_id],
            effective_date: update_params[:effective_date]
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          result = operation.value!
          subscription = result[:space_subscription]
          payment_session = result[:payment_session]

          subscription_serializer = ::Finance::SpaceSubscriptionSerializer.render_as_hash(subscription)

          # Extract payment session URL from the operation result
          # Xendit payment session response uses symbolized keys (from deep_symbolize_keys)
          # The URL can be in :payment_link_url, :url, or :payment_url
          payment_session_url = if payment_session.is_a?(Hash)
                                  payment_session[:payment_link_url] ||
                                  payment_session[:url] ||
                                  payment_session[:payment_url]
          end

          response_data = { subscription: subscription_serializer }
          response_data[:payment_session_url] = payment_session_url if payment_session_url.present?

          render_success(
            data: response_data,
            message: result[:message] || "Subscription updated successfully"
          )
        end

        def cancel
          operation = ::Finance::Operations::Subscriptions::CancelSubscription.new.call(
            space_id: current_space.id.to_s,
            subscription_id: params[:id]
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          subscription = operation.value!
          subscription_serializer = ::Finance::SpaceSubscriptionSerializer.render_as_hash(subscription)

          render_success(
            data: { subscription: subscription_serializer },
            message: "Subscription cancelled successfully"
          )
        end

        def simulate_cycle_payment
          return render_error(
            message: "Simulate cycle payment is only available in development or staging",
            status: :forbidden
          ) unless Rails.env.development? || Rails.env.staging?

          operation = ::Finance::Operations::Subscriptions::SimulateCyclePayment.new.call(
            space_id: current_space.id.to_s,
            billing_cycle_id: simulate_params[:billing_cycle_id],
            amount: simulate_params[:amount]
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          result = operation.value!

          render_success(
            data: result,
            message: "Cycle payment simulated successfully"
          )
        end

        def force_attempt_cycle
          return render_error(
            message: "Force attempt is only available in development or staging",
            status: :forbidden
          ) unless Rails.env.development? || Rails.env.staging?

          operation = ::Finance::Operations::Subscriptions::ForceAttemptCycle.new.call(
            space_id: current_space.id.to_s,
            billing_cycle_id: force_attempt_params[:billing_cycle_id]
          )

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          result = operation.value!

          render_success(
            data: result,
            message: "Cycle force attempt initiated successfully"
          )
        end

        private

        def simulate_params
          params.permit(:billing_cycle_id, :amount)
        end

        def force_attempt_params
          params.permit(:billing_cycle_id)
        end

        def create_params
          params.permit(
            :space_id,
            :subscription_plan_id,
            :sponsor_code,
            :total_cycles,
            :anchor_date,
            :success_return_url,
            :failure_return_url
          )
        end

        def update_params
          params.permit(:subscription_plan_id, :effective_date)
        end

        def cancel_params
          params.permit(:space_id, :subscription_id)
        end
      end
    end
  end
end
