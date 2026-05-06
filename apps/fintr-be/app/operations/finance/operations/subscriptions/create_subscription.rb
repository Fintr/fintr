# frozen_string_literal: true

module Finance
  module Operations
    module Subscriptions
      class CreateSubscription < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:subscription_plan_id).value(:string)
            required(:user_id).value(:string)
            optional(:sponsor_code).maybe(:string)
            optional(:total_cycles).maybe(:integer, gt?: 0)
            optional(:anchor_date).maybe(:date_time)
            optional(:success_return_url).maybe(:string)
            optional(:failure_return_url).maybe(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params              = step validate(params:)
          space               = step find_space(params:)
          _                   = step validate_no_active_subscription(space:)
          subscription_plan   = step find_subscription_plan(params:)
          sponsor_code_data   = step apply_sponsor_code_if_present(params:)
          customer_data       = step find_or_create_customer_for_space(space:)
          params              = step fix_anchor_date(params:)
          xendit_response     = step create_xendit_subscription(
                                        space:,
                                        subscription_plan:,
                                        customer_data:,
                                        sponsor_code_data:,
                                        params:
                                      )
          space_subscription  = step create_space_subscription(
                                        space:,
                                        subscription_plan:,
                                        xendit_response:,
                                        sponsor_code_data:,
                                        customer_data:,
                                        params:
                                      )
          _                   = step record_sponsor_code_usage(sponsor_code_data:, space_subscription:, params:)
          action_url          = step find_action_url(xendit_response:)

          {
            space_subscription: space_subscription,
            action_url: action_url,
            status: xendit_response[:status]
          }
        end

        private

        def find_space(params:)
          space = Spaces::Space.find_by(id: params[:space_id])
          return Failure(space_id: "not found") unless space

          Success(space)
        end

        def validate_no_active_subscription(space:)
          active_subscription = Finance::SpaceSubscription.active.for_space(space.id).first
          return Failure(subscription: "Space already has an active subscription. Please cancel it first.") if active_subscription

          Success(true)
        end

        def find_subscription_plan(params:)
          plan = Finance::SubscriptionPlan.find_by(id: params[:subscription_plan_id])
          return Failure(subscription_plan_id: "not found") unless plan

          Success(plan)
        end

        def find_or_create_customer_for_space(space:)
          Finance::Operations::Customers::FindOrCreateCustomerForSpace.new.call(space_id: space.id.to_s)
        end

        # NOTE: Xendit does not support anchor dates greater than 28th day of the month
        # We store the original date in metadata to calculate correct billing cycle end dates
        def fix_anchor_date(params:)
          original_anchor_date = params[:anchor_date] || Time.zone.now
          xendit_anchor_date = original_anchor_date

          # Clamp to day 28 for Xendit if day is 29-31
          if original_anchor_date.day > 28
            xendit_anchor_date = DateTime.new(
              original_anchor_date.year,
              original_anchor_date.month,
              28,
              original_anchor_date.hour,
              original_anchor_date.min,
              original_anchor_date.sec
            )
          end

          # Store original date in params for metadata
          params[:original_anchor_date] = original_anchor_date.iso8601
          params[:anchor_date] = xendit_anchor_date.iso8601

          Success(params)
        end

        def create_xendit_subscription(space:, subscription_plan:, customer_data:, sponsor_code_data:, params:)
          client = Integrations::Payments::Xendit::Client.new

          schedule_reference_id = "schedule-#{SecureRandom.uuid}"
          schedule = {
            reference_id: schedule_reference_id,
            interval: subscription_plan.interval.upcase,
            interval_count: 1,
            total_recurrence: params[:total_cycles],
            anchor_date: params[:anchor_date],
            retry_interval: "DAY",
            retry_interval_count: 1,
            total_retry: 3,
            failed_attempt_notifications: [1, 3]
          }

          subscription_reference_id = "sub-#{SecureRandom.uuid}"

          # Build base URL for return URLs
          base_url = ENV.fetch("FRONTEND_URL", "http://localhost:3000")

          # Use discounted amount if sponsor code was applied
          final_amount = if sponsor_code_data
            sponsor_code_data[:discount][:final_amount_cents] / 100.0
          else
            subscription_plan.price_cents / 100.0
          end

          xendit_params = {
            reference_id: subscription_reference_id,
            customer_id: customer_data[:id],
            currency: subscription_plan.price_currency,
            amount: final_amount,
            schedule: schedule,
            notification_config: {
              locale: "en",
              recurring_created: ["EMAIL"],
              recurring_succeeded: ["EMAIL"],
              recurring_failed: ["EMAIL"]
            },
            failed_cycle_action: "STOP",
            immediate_action_type: "FULL_AMOUNT",
            success_return_url: params[:success_return_url] || "#{base_url}/dashboard/subscriptions?success=true",
            failure_return_url: params[:failure_return_url] || "#{base_url}/dashboard/subscriptions?failure=true",
            payment_link_for_failed_attempt: true
          }

          response = client.create_subscription_plan(params: xendit_params)

          Success(response)
        rescue Integrations::Payments::Xendit::Error => e
          Failure(xendit_error: e.message, status: e.status, code: e.code)
        rescue StandardError => e
          Failure(error: "Failed to create Xendit subscription: #{e.message}")
        end

        def apply_sponsor_code_if_present(params:)
          return Success(nil) if params[:sponsor_code].blank?

          result = Finance::Operations::Subscriptions::ApplySponsorCode.new.call(
            sponsor_code: params[:sponsor_code],
            subscription_plan_id: params[:subscription_plan_id],
            user_id: params[:user_id].to_s
          )

          return Failure(result.failure) if result.failure?

          Success(result.value!)
        end

        def create_space_subscription(space:, subscription_plan:, xendit_response:, sponsor_code_data:, customer_data:, params:)
          # Use original anchor date for started_at to ensure correct billing cycle calculations
          # Xendit will use the clamped date (28th) for scheduling, but we use original for our records
          original_start_date = params[:original_anchor_date] ? DateTime.parse(params[:original_anchor_date]) : (params[:anchor_date] ? DateTime.parse(params[:anchor_date]) : Time.current)

          metadata = xendit_response.dup
          # Store original anchor date in metadata for billing cycle calculations
          metadata["original_anchor_date"] = params[:original_anchor_date] || params[:anchor_date]
          metadata["xendit_anchor_date"] = params[:anchor_date] # Store what we sent to Xendit

          # Store sponsor code info in metadata if present
          if sponsor_code_data
            metadata["sponsor_code"] = sponsor_code_data[:sponsor_code]&.code
            metadata["discount_applied"] = {
              original_amount_cents: sponsor_code_data[:discount][:original_amount_cents],
              discount_amount_cents: sponsor_code_data[:discount][:discount_amount_cents],
              final_amount_cents: sponsor_code_data[:discount][:final_amount_cents],
              discount_percentage: sponsor_code_data[:discount][:discount_percentage],
              discount_percentage_applied: sponsor_code_data[:discount][:discount_percentage_applied],
              discount_amount_cents_applied: sponsor_code_data[:discount][:discount_amount_cents_applied],
              discount_months: sponsor_code_data[:discount][:discount_months],
              promo_expires_at: sponsor_code_data[:discount][:promo_expires_at],
              is_limited_duration: sponsor_code_data[:discount][:is_limited_duration]
            }
            # Store original amount for future reference when promo expires
            metadata["original_subscription_amount_cents"] = sponsor_code_data[:discount][:original_amount_cents]
          end

          space_subscription = Finance::SpaceSubscription.create!(
            space: space,
            subscription_plan: subscription_plan,
            sponsor_code: sponsor_code_data&.dig(:sponsor_code),
            xendit_plan_id: xendit_response[:id],
            xendit_reference_id: xendit_response[:reference_id],
            xendit_customer_id: customer_data[:id],
            xendit_customer_reference_id: customer_data[:reference_id],
            xendit_schedule_id: xendit_response.dig(:schedule, :id),
            xendit_schedule_reference_id: xendit_response.dig(:schedule, :reference_id),
            status: xendit_response[:status]&.downcase || "pending",
            started_at: original_start_date,
            total_cycles: params[:total_cycles],
            metadata: metadata
          )

          Success(space_subscription)
        rescue ActiveRecord::RecordInvalid => e
          Failure(space_subscription: e.record.errors.full_messages)
        rescue StandardError => e
          Failure(error: "Failed to create space subscription: #{e.message}")
        end

        def record_sponsor_code_usage(sponsor_code_data:, space_subscription:, params:)
          return Success(true) if sponsor_code_data.nil? || sponsor_code_data[:sponsor_code].nil?

          sponsor_code = sponsor_code_data[:sponsor_code]
          discount = sponsor_code_data[:discount]
          user_id = params[:user_id].to_s

          # Verify user exists before creating usage record
          user = Auth::User.find_by(id: user_id)
          return Failure(user_sponsor_code: "User not found") unless user

          Finance::UserSponsorCode.create!(
            sponsor_code: sponsor_code,
            user_id: user_id,
            space_subscription: space_subscription,
            discount_percentage_applied: discount[:discount_percentage_applied],
            discount_amount_cents_applied: discount[:discount_amount_cents_applied]
          )

          sponsor_code.record_usage!

          Success(true)
        rescue ActiveRecord::RecordInvalid => e
          Failure(user_sponsor_code: e.record.errors.full_messages)
        end

        # Extract action URL from multiple possible locations in Xendit response
        # Xendit returns actions as an array with url field

        def find_action_url(xendit_response:)
          action_url = xendit_response[:action_url] ||
                        xendit_response.dig(:actions, 0, :url) ||
                        xendit_response.dig(:actions, 0, :redirect_url) ||
                        xendit_response.dig(:action, :url) ||
                        xendit_response.dig(:action, :redirect_url) ||
                        xendit_response[:redirect_url]
          Success(action_url)
        end
      end
    end
  end
end
