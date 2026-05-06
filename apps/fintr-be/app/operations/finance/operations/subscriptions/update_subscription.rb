# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Finance
  module Operations
    module Subscriptions
      class UpdateSubscription < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:subscription_id).value(:string)
            required(:new_subscription_plan_id).value(:string)
            optional(:effective_date).maybe(:date_time)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler
        include Dry::Operation::Extensions::ActiveRecord

        def call(params)
          transaction do
            params = step validate(params:)
            space = step find_space(params:)
            current_subscription = step find_subscription(params:, space:)
            new_plan = step find_new_plan(params:)
            _ = step validate_can_update(current_subscription:, new_plan:)
            proration = step calculate_proration(
              current_subscription:,
              new_plan:,
              effective_date: params[:effective_date]
            )

            result = step handle_proration_result(
              current_subscription:,
              new_plan:,
              proration:
            )

            {
              space_subscription: current_subscription.reload,
              payment_session: result[:payment_session],
              xendit_response: result[:xendit_response],
              message: result[:message]
            }
          end
        end

        private

        def find_space(params:)
          space = Spaces::Space.find_by(id: params[:space_id])
          return Failure(space_id: "not found") unless space

          Success(space)
        end

        def find_subscription(params:, space:)
          subscription = Finance::SpaceSubscription
                         .for_space(space.id)
                         .find_by(id: params[:subscription_id])

          return Failure(subscription_id: "not found") unless subscription

          Success(subscription)
        end

        def find_new_plan(params:)
          plan = Finance::SubscriptionPlan.find_by(id: params[:new_subscription_plan_id])
          return Failure(new_subscription_plan_id: "not found") unless plan
          return Failure(new_subscription_plan_id: "plan is not active") unless plan.active?

          Success(plan)
        end

        def validate_can_update(current_subscription:, new_plan:)
          # Subscription must be active
          unless current_subscription.active?
            return Failure(subscription: "must be active to update")
          end

          # Check for failed billing cycles - user must pay for failed cycles before changing plan
          failed_cycles = current_subscription.billing_cycles.where(status: :failed)
          if failed_cycles.exists?
            return Failure(subscription: "cannot change plan with failed billing cycles. Please pay for failed cycles first.")
          end

          # Check if plan change already occurred in current cycle
          # Check metadata for plan_change first (faster check)
          plan_change_metadata = current_subscription.metadata&.dig("plan_change")
          if plan_change_metadata.present? && plan_change_metadata["changed_at"].present?
            changed_at = DateTime.parse(plan_change_metadata["changed_at"])
            current_cycle = current_subscription.current_paid_cycle

            # If there's a current paid cycle and the plan change happened during it, block update
            if current_cycle && changed_at.between?(current_cycle.started_at, current_cycle.ends_at)
              return Failure(subscription: "plan already changed for the billing cycle")
            end

            # If no current cycle but plan change exists, also check for prorated cycles
            unless current_cycle
              existing_prorated = current_subscription.billing_cycles
                                                      .where("metadata->>'prorated' = 'true'")
                                                      .exists?

              if existing_prorated
                return Failure(subscription: "plan already changed for the billing cycle")
              end
            end
          end

          # Also check for prorated cycles associated with current cycle
          # Prorated cycles have cycle_number = original_cycle_number + 0.1 (e.g., 1.1, 2.1)
          current_cycle = current_subscription.current_paid_cycle
          if current_cycle
            original_cycle_number = current_cycle.cycle_number
            prorated_cycle_number = (original_cycle_number + 0.1).round(1)

            existing_prorated = current_subscription.billing_cycles
                                                    .where("metadata->>'prorated' = 'true'")
                                                    .where(cycle_number: prorated_cycle_number)
                                                    .exists?

            if existing_prorated
              return Failure(subscription: "plan already changed for the billing cycle")
            end
          end

          Success(true)
        end

        def calculate_proration(current_subscription:, new_plan:, effective_date:)
          CalculateProration.new.call(
            current_subscription:,
            new_plan:,
            effective_date:
          )
        end

        def handle_proration_result(current_subscription:, new_plan:, proration:)
          # Handle cases where no proration is needed
          if proration[:no_proration]
            return handle_no_proration_case(
              current_subscription:,
              new_plan:,
              proration:
            )
          end

          # Handle upgrades vs downgrades differently
          route_plan_change_action(
            current_subscription:,
            new_plan:,
            proration:
          )
        end

        def handle_no_proration_case(current_subscription:, new_plan:, proration:)
          # If same plan, no action needed
          if proration[:same_plan]
            return Success({
              message: "Same plan selected",
              payment_session: nil,
              xendit_response: nil
            })
          end

          # If no current paid cycle, update plan without proration
          # This handles cases where subscription doesn't have a paid cycle yet
          if proration[:no_current_cycle]
            return update_plan_without_cycle(
              current_subscription:,
              new_plan:
            )
          end

          Success({
            message: "Plan updated (no proration needed)",
            payment_session: nil,
            xendit_response: nil
          })
        end

        def route_plan_change_action(current_subscription:, new_plan:, proration:)
          case proration[:action]
          when "upgrade"
            handle_upgrade(
              current_subscription:,
              new_plan:,
              proration:
            )
          when "downgrade"
            handle_downgrade(
              current_subscription:,
              new_plan:,
              proration:
            )
          else
            Failure(plan_change: "Unsupported plan change action")
          end
        end

        def update_plan_without_cycle(current_subscription:, new_plan:)
          # For subscriptions without a paid cycle yet
          # Compare plans to determine if it's an upgrade or downgrade
          plan_comparison = step compare_plans_for_new_subscription(
            current_subscription:,
            new_plan:
          )

          # For upgrades: require payment BEFORE updating (same pattern as handle_upgrade)
          # For downgrades: can update immediately since no payment is required
          if plan_comparison[:action] == "upgrade"
            return handle_upgrade_without_cycle(
              current_subscription:,
              new_plan:,
              plan_comparison:
            )
          end

          # For downgrades: update immediately (no payment required)
          xendit_response = step update_xendit_plan_amount(
            current_subscription:,
            new_plan:
          )

          # Update local subscription plan
          plan_change_metadata = {
            "old_plan_id" => current_subscription.subscription_plan_id.to_s,
            "new_plan_id" => new_plan.id.to_s,
            "changed_at" => Time.zone.now.iso8601,
            "action" => plan_comparison[:action],
            "no_proration" => true
          }

          current_subscription.update!(
            subscription_plan_id: new_plan.id,
            metadata: (current_subscription.metadata || {}).merge(
              "plan_change" => plan_change_metadata
            )
          )

          Success({
            xendit_response: xendit_response,
            payment_session: nil,
            message: "Plan downgraded - effective immediately"
          })
        end

        def handle_upgrade_without_cycle(current_subscription:, new_plan:, plan_comparison:)
          # For upgrades without a cycle: require payment BEFORE updating
          # DO NOT update plan until payment is confirmed
          # Store pending plan change in metadata
          # Plan will be updated when payment.session.succeeded webhook is received

          old_plan_id = current_subscription.subscription_plan_id

          # Create payment session FIRST (before any changes)
          # Charge the FULL new plan amount (not just difference) because user hasn't paid for the old plan yet
          payment_session = step create_payment_for_plan_difference(
            current_subscription:,
            new_plan:,
            difference_cents: plan_comparison[:difference_cents],
            charge_full_amount: true
          )

          # Store pending plan change in metadata (DO NOT update plan yet)
          # This will be processed when payment.session.succeeded webhook arrives
          payment_session_id = payment_session[:id] || payment_session[:payment_session_id]

          pending_plan_change = {
            "old_plan_id" => old_plan_id.to_s,
            "new_plan_id" => new_plan.id.to_s,
            "requested_at" => Time.zone.now.iso8601,
            "amount_cents" => new_plan.price_cents.to_s,
            "action" => "upgrade",
            "payment_session_id" => payment_session_id.to_s,
            "payment_session_url" => (payment_session[:payment_link_url] || payment_session[:url] || payment_session[:payment_url]).to_s,
            "no_current_cycle" => true,
            "charge_full_amount" => true,
            "pending" => true
          }

          Rails.logger.info("Storing pending plan change (no cycle) with payment_session_id: #{payment_session_id}")

          current_subscription.update!(
            metadata: (current_subscription.metadata || {}).merge(
              "pending_plan_change" => pending_plan_change
            )
          )

          Success({
            payment_session: payment_session,
            message: "Payment required to complete plan upgrade"
          })
        end

        def compare_plans_for_new_subscription(current_subscription:, new_plan:)
          old_plan = current_subscription.subscription_plan
          difference_cents = new_plan.price_cents - old_plan.price_cents

          action = if difference_cents > 0
                     "upgrade"
          elsif difference_cents < 0
                     "downgrade"
          else
                     "change"
          end

          Success({
            action: action,
            difference_cents: difference_cents.abs
          })
        rescue StandardError => e
          Failure(error: "Failed to compare plans: #{e.message}")
        end

        def create_payment_for_plan_difference(current_subscription:, new_plan:, difference_cents:, charge_full_amount: false)
          # If no paid cycle exists, charge the FULL new plan amount (not just the difference)
          # because the user hasn't paid for the old plan yet
          amount_cents = if charge_full_amount
                          new_plan.price_cents
          else
                          difference_cents
          end

          return Success(nil) if amount_cents <= 0

          client = Integrations::Payments::Xendit::Client.new

          # Build base URL for return URLs
          base_url = if Rails.env.development?
                       "https://staging.fintr.ai"
          else
                       ENV.fetch("FRONTEND_URL", "https://staging.fintr.ai")
          end

          response = client.create_payment_session(
            params: {
              reference_id: "upg-#{current_subscription.id}|#{SecureRandom.hex(8)}",
              customer_id: current_subscription.xendit_customer_id,
              session_type: "PAY",
              currency: new_plan.price_currency,
              amount: difference_cents / 100.0,
              country: "PH",
              mode: "PAYMENT_LINK",
              success_redirect_url: "#{base_url}/dashboard/subscriptions?upgrade_success=true",
              failure_redirect_url: "#{base_url}/dashboard/subscriptions?upgrade_failed=true",
              cancel_return_url: "#{base_url}/dashboard/subscriptions?upgrade_failed=true",
              metadata: {
                type: "subscription_plan_upgrade",
                subscription_id: current_subscription.id.to_s,
                difference_cents: difference_cents.to_s
              }
            }
          )

          Success(response)
        rescue Integrations::Payments::Xendit::Error => e
          Failure(xendit_error: e.message, status: e.status, code: e.code)
        rescue StandardError => e
          Failure(error: "Failed to create payment session: #{e.message}")
        end

        def handle_upgrade(current_subscription:, new_plan:, proration:)
          # For upgrades: require payment BEFORE updating
          # DO NOT update plan or create cycles until payment is confirmed
          # Store pending plan change in metadata
          # Create payment session for prorated amount
          # Plan will be updated when payment.session.succeeded webhook is received

          current_cycle = proration[:current_cycle]
          old_plan_id = current_subscription.subscription_plan_id

          # Create payment session FIRST (before any changes)
          payment_session = step create_payment_session_for_proration(
            current_subscription:,
            new_plan:,
            proration:
          )

          # Store pending plan change in metadata (DO NOT update plan yet)
          # This will be processed when payment.session.succeeded webhook arrives
          # Xendit may return id as :id or :payment_session_id, handle both
          payment_session_id = payment_session[:id] || payment_session[:payment_session_id]

          pending_plan_change = {
            "old_plan_id" => old_plan_id.to_s,
            "new_plan_id" => new_plan.id.to_s,
            "requested_at" => Time.zone.now.iso8601,
            "prorated_amount_cents" => proration[:prorated_amount_cents],
            "action" => "upgrade",
            "payment_session_id" => payment_session_id.to_s,
            "payment_session_url" => (payment_session[:payment_link_url] || payment_session[:url] || payment_session[:payment_url]).to_s,
            "current_cycle_id" => current_cycle.id.to_s,
            "proration" => {
              "current_cycle_start" => current_cycle.started_at.iso8601,
              "current_cycle_end" => current_cycle.ends_at.iso8601,
              "prorated_amount_cents" => proration[:prorated_amount_cents]
            },
            "pending" => true
          }

          Rails.logger.info("Storing pending plan change with payment_session_id: #{payment_session_id}")

          current_subscription.update!(
            metadata: (current_subscription.metadata || {}).merge(
              "pending_plan_change" => pending_plan_change
            )
          )

          Success({
            payment_session: payment_session,
            message: "Payment required to complete plan upgrade"
          })
        end

        def handle_downgrade(current_subscription:, new_plan:, proration:)
          # For downgrades: no immediate payment, just update plan reference
          # Tokens stay the same until next cycle
          # Next cycle will charge new (lower) amount

          # Update Xendit subscription plan amount
          xendit_response = step update_xendit_plan_amount(
            current_subscription:,
            new_plan:
          )

          # Update local subscription to new plan
          # Note: tokens_allocated in current cycle stays the same
          current_subscription.update!(
            subscription_plan_id: new_plan.id,
            metadata: current_subscription.metadata.merge(
              "plan_change" => {
                "old_plan_id" => current_subscription.subscription_plan_id.to_s,
                "new_plan_id" => new_plan.id.to_s,
                "changed_at" => Time.zone.now.iso8601,
                "prorated_amount_cents" => proration[:prorated_amount_cents],
                "action" => "downgrade",
                "effective_next_cycle" => true
              }
            )
          )

          Success({
            xendit_response: xendit_response,
            note: "Downgrade will take effect on next billing cycle"
          })
        end

        def update_xendit_plan_amount(current_subscription:, new_plan:)
          client = Integrations::Payments::Xendit::Client.new

          params = {
            amount: new_plan.price_cents / 100.0,
            currency: new_plan.price_currency
          }

          response = client.update_subscription_plan(
            plan_id: current_subscription.xendit_plan_id,
            params: params
          )

          Success(response)
        rescue Integrations::Payments::Xendit::Error => e
          Failure(xendit_error: e.message, status: e.status, code: e.code)
        rescue StandardError => e
          Failure(error: "Failed to update Xendit plan: #{e.message}")
        end

        def create_payment_session_for_proration(current_subscription:, new_plan:, proration:)
          return Success(nil) if proration[:prorated_amount_cents] <= 0

          client = Integrations::Payments::Xendit::Client.new

          # Use new plan's currency
          currency = new_plan.price_currency

          # Build base URL for return URLs
          # Xendit requires HTTPS URLs, so use staging URL for development
          if Rails.env.development?
            base_url = "https://staging.fintr.ai"
          else
            base_url = ENV.fetch("FRONTEND_URL", "https://staging.fintr.ai")
          end

          response = client.create_payment_session(
            params: {
              reference_id: "upg-#{current_subscription.id}|#{SecureRandom.hex(8)}",
              customer_id: current_subscription.xendit_customer_id,
              session_type: "PAY",
              currency: currency,
              amount: proration[:prorated_amount_cents] / 100.0,
              country: "PH",
              mode: "PAYMENT_LINK",
              success_redirect_url: "#{base_url}/dashboard/subscriptions?upgrade_success=true",
              failure_redirect_url: "#{base_url}/dashboard/subscriptions?upgrade_failed=true",
              cancel_return_url: "#{base_url}/dashboard/subscriptions?upgrade_failed=true",
              metadata: {
                type: "subscription_upgrade_proration",
                subscription_id: current_subscription.id.to_s,
                prorated_amount_cents: proration[:prorated_amount_cents].to_s
              }
            }
          )

          # Log the payment session response for debugging
          payment_session_id = response[:id] || response[:payment_session_id]
          Rails.logger.info("Payment session created: id=#{payment_session_id}, url=#{response[:payment_link_url] || response[:url] || response[:payment_url]}")
          Rails.logger.info("Payment session response keys: #{response.keys.inspect}")

          Success(response)
        rescue Integrations::Payments::Xendit::Error => e
          Failure(xendit_error: e.message, status: e.status, code: e.code)
        rescue StandardError => e
          Failure(error: "Failed to create payment session: #{e.message}")
        end
      end
    end
  end
end
