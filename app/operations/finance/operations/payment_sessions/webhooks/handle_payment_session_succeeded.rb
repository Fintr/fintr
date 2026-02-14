# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Finance
  module Operations
    module PaymentSessions
      module Webhooks
        class HandlePaymentSessionSucceeded < Dry::Operation
          class Contract < Dry::Validation::Contract
            params do
              optional(:id).maybe(:string) # Payment session ID (legacy)
              optional(:payment_session_id).maybe(:string) # Payment session ID (new format)
              required(:status).value(:string)
              optional(:reference_id).maybe(:string)
              optional(:metadata).maybe(:hash)
              optional(:amount).value(:decimal)
              optional(:currency).maybe(:string)
              optional(:payment_id).maybe(:string) # Payment ID from Xendit
              optional(:payment_token_id).maybe(:string) # Payment token/method ID from Xendit
            end

            rule(:id, :payment_session_id) do
              key.failure("either id or payment_session_id must be present") if values[:id].blank? && values[:payment_session_id].blank?
            end
          end

          def validate(params:)
            contract = Contract.new.call(**params)
            return Failure(contract.errors.to_h) unless contract.success?

            # Normalize to use :id for consistency
            validated_params = contract.to_h
            validated_params[:id] ||= validated_params[:payment_session_id]
            validated_params.delete(:payment_session_id)

            Success(validated_params)
          end

          include FailureHandler
          include Dry::Operation::Extensions::ActiveRecord

          def call(params)
            transaction do
              params              = step validate(params:)

              # Log the payment session ID for debugging
              Rails.logger.info("Processing payment session webhook: id=#{params[:id]}, status=#{params[:status]}")

              subscription        = step find_subscription_by_payment_session(params:)
              pending_change      = step extract_pending_plan_change(subscription:)
              _                   = step validate_pending_change(pending_change:, payment_session_id: params[:id])
              new_plan            = step find_new_plan(pending_change:)

              # Handle "no_current_cycle" case differently
              if pending_change["no_current_cycle"] == true
                result = step apply_plan_change_without_cycle(
                  subscription:,
                  new_plan:,
                  pending_change:,
                  params:
                )
              else
                proration           = step calculate_proration_for_pending_change(
                                          subscription:,
                                          new_plan:,
                                          pending_change:
                                        )
                result              = step apply_plan_change(
                                          subscription:,
                                          new_plan:,
                                          proration:,
                                          pending_change:
                                        )
              end

              # Create payment and mark prorated cycle as paid if prorated cycle was created
              # Skip for "no_current_cycle" case as payment is already created in apply_plan_change_without_cycle
              if result.is_a?(Hash) && result[:prorated_cycle].present? && !pending_change["no_current_cycle"]
                _                = step create_payment_for_proration(
                                      subscription:,
                                      prorated_cycle: result[:prorated_cycle],
                                      params:
                                    )
              end

              _                   = step clear_pending_change(subscription:)

              Rails.logger.info("Plan upgrade completed successfully: subscription_id=#{subscription.id}, new_plan_id=#{new_plan.id}")

              # Broadcast update to Action Cable subscribers
              broadcast_subscription_update(subscription:)

              {
                message: "Plan upgrade completed successfully",
                subscription_id: subscription.id,
                new_plan_id: new_plan.id
              }
            end
          end

          private

          def find_subscription_by_payment_session(params:)
            # Find subscription by payment_session_id in pending_plan_change metadata
            payment_session_id = params[:id].to_s

            Rails.logger.info("Looking for subscription with payment_session_id: #{payment_session_id}")

            # First try direct query
            subscription = Finance::SpaceSubscription
                          .where("metadata->'pending_plan_change'->>'payment_session_id' = ?", payment_session_id)
                          .first

            # If not found, try searching all subscriptions with pending_plan_change
            unless subscription
              Rails.logger.info("Direct query failed, searching all subscriptions with pending_plan_change")
              all_with_pending = Finance::SpaceSubscription
                                .where("metadata->'pending_plan_change' IS NOT NULL")

              subscription = all_with_pending.find do |sub|
                stored_id = sub.metadata&.dig("pending_plan_change", "payment_session_id")
                Rails.logger.info("Checking subscription #{sub.id}: stored_id=#{stored_id}, looking_for=#{payment_session_id}")
                stored_id == payment_session_id
              end
            end

            if subscription
              Rails.logger.info("Found subscription #{subscription.id} for payment session #{payment_session_id}")
            else
              Rails.logger.error("No subscription found for payment session #{payment_session_id}")
              # Log all pending plan changes for debugging
              Finance::SpaceSubscription.where("metadata->'pending_plan_change' IS NOT NULL").each do |sub|
                Rails.logger.error("Subscription #{sub.id} has pending_plan_change: #{sub.metadata&.dig('pending_plan_change', 'payment_session_id')}")
              end
            end

            return Failure(subscription: "not found for payment session #{payment_session_id}") unless subscription

            Success(subscription)
          end

          def extract_pending_plan_change(subscription:)
            pending_change = subscription.metadata&.dig("pending_plan_change")

            return Failure(pending_change: "not found") unless pending_change.present?
            return Failure(pending_change: "not pending") unless pending_change["pending"] == true

            Success(pending_change)
          end

          def validate_pending_change(pending_change:, payment_session_id:)
            if pending_change["payment_session_id"] != payment_session_id
              return Failure(payment_session: "mismatch")
            end

            Success(true)
          end

          def find_new_plan(pending_change:)
            plan = Finance::SubscriptionPlan.find_by(id: pending_change["new_plan_id"])

            return Failure(new_plan_id: "not found") unless plan
            return Failure(new_plan_id: "plan is not active") unless plan.active?

            Success(plan)
          end

          def calculate_proration_for_pending_change(subscription:, new_plan:, pending_change:)
            # Use the proration data stored in pending_change
            proration_data = pending_change["proration"]

            current_cycle_id = pending_change["current_cycle_id"]
            current_cycle = Finance::BillingCycle.find_by(id: current_cycle_id)

            return Failure(current_cycle: "not found") unless current_cycle

            Success({
              current_cycle: current_cycle,
              prorated_amount_cents: proration_data["prorated_amount_cents"].to_i,
              current_cycle_start: DateTime.parse(proration_data["current_cycle_start"]),
              current_cycle_end: DateTime.parse(proration_data["current_cycle_end"])
            })
          end

          def apply_plan_change_without_cycle(subscription:, new_plan:, pending_change:, params:)
            # For subscriptions without a current cycle, simply update the plan
            # No proration or cycle splitting needed
            old_plan_id = subscription.subscription_plan_id
            now = Time.zone.now

            # Update Xendit subscription plan amount
            client = Integrations::Payments::Xendit::Client.new

            xendit_params = {
              amount: new_plan.price_cents / 100.0,
              currency: new_plan.price_currency
            }

            client.update_subscription_plan(
              plan_id: subscription.xendit_plan_id,
              params: xendit_params
            )

            # Update local subscription to new plan
            subscription.update!(
              subscription_plan_id: new_plan.id,
              metadata: subscription.metadata.merge(
                "plan_change" => {
                  "old_plan_id" => old_plan_id.to_s,
                  "new_plan_id" => new_plan.id.to_s,
                  "changed_at" => now.iso8601,
                  "action" => "upgrade",
                  "no_proration" => true,
                  "charge_full_amount" => pending_change["charge_full_amount"] == true,
                  "amount_cents" => pending_change["amount_cents"]
                }
              )
            )

            # Update all upcoming pending billing cycles to use new plan's token allocation
            _ = step update_upcoming_cycles_tokens(subscription:, new_plan:)

            # Create payment record for the full amount
            amount_cents = (pending_change["amount_cents"] || new_plan.price_cents).to_i
            currency = params[:currency].presence ||
              new_plan.price_currency.presence ||
              subscription.space.currency.presence ||
              "PHP"
            payment_id = params[:payment_id] || "ps-#{SecureRandom.hex(8)}"

            payment = Finance::Payment.find_or_initialize_by(
              xendit_cycle_id: payment_id
            )

            payment.assign_attributes(
              space_subscription: subscription,
              billing_cycle: nil, # No cycle for this payment
              xendit_reference_id: params[:reference_id],
              amount_cents: amount_cents,
              amount_currency: currency,
              status: "succeeded",
              paid_at: now,
              xendit_data: params.deep_stringify_keys,
              metadata: {
                type: "subscription_plan_upgrade",
                payment_session_id: params[:id],
                payment_id: payment_id,
                no_current_cycle: true,
                charge_full_amount: pending_change["charge_full_amount"] == true
              }
            )

            payment.save!

            Rails.logger.info("Plan upgrade completed (no cycle): subscription_id=#{subscription.id}, new_plan_id=#{new_plan.id}, payment_id=#{payment.id}")

            Success({
              note: "Plan updated - no cycle case",
              payment: payment
            })
          rescue StandardError => e
            Rails.logger.error("Failed to apply plan change (no cycle): #{e.message}")
            Failure(error: "Failed to apply plan change: #{e.message}")
          end

          def apply_plan_change(subscription:, new_plan:, proration:, pending_change:)
            current_cycle = proration[:current_cycle]
            old_plan_id = subscription.subscription_plan_id

            # Save original cycle end date BEFORE updating the cycle
            original_cycle_end = current_cycle.ends_at
            original_cycle_start = current_cycle.started_at

            # End old cycle at the time the payment was requested (from pending_change)
            # Start new cycle immediately after
            requested_at = DateTime.parse(pending_change["requested_at"])
            now = Time.zone.now

            # Use requested_at for cycle end to maintain consistency
            cycle_end_for_old = [requested_at, original_cycle_end].min
            cycle_end_for_old = [cycle_end_for_old, original_cycle_start].max
            prorated_cycle_start = [cycle_end_for_old + 1.second, now].max

            # Only create prorated cycle if there's remaining time
            if prorated_cycle_start >= original_cycle_end
              # No prorated cycle needed - just update the plan
              subscription.update!(
                subscription_plan_id: new_plan.id,
                metadata: subscription.metadata.merge(
                  "plan_change" => {
                    "old_plan_id" => old_plan_id.to_s,
                    "new_plan_id" => new_plan.id.to_s,
                    "changed_at" => now.iso8601,
                    "action" => "upgrade",
                    "no_proration" => true
                  }
                )
              )

              # Update all upcoming pending billing cycles to use new plan's token allocation
              _ = step update_upcoming_cycles_tokens(subscription:, new_plan:)

              return Success({ note: "Plan updated - no prorated cycle needed" })
            end

            # Update current cycle span
            current_cycle.update!(
              span: (original_cycle_start..cycle_end_for_old)
            )

            # Create prorated cycle for remaining period with new plan tokens
            original_cycle_number = current_cycle.cycle_number
            prorated_cycle_number = (original_cycle_number + 0.1).round(1)

            # Generate a temporary xendit_cycle_id for prorated cycles
            xendit_cycle_id = "prorated-#{subscription.id}|#{original_cycle_number}|#{SecureRandom.uuid}"

            prorated_cycle = subscription.billing_cycles.create!(
              cycle_number: prorated_cycle_number,
              span: (prorated_cycle_start..original_cycle_end),
              tokens_allocated: new_plan.token_limit,
              xendit_cycle_id: xendit_cycle_id,
              status: "pending",
              metadata: {
                prorated: true,
                old_plan_id: old_plan_id.to_s,
                new_plan_id: new_plan.id.to_s,
                prorated_amount_cents: proration[:prorated_amount_cents],
                action: "upgrade",
                effective_date: now.iso8601,
                original_cycle_number: original_cycle_number
              }
              )

            # Update Xendit subscription plan amount
            client = Integrations::Payments::Xendit::Client.new
            client.update_subscription_plan(
              plan_id: subscription.xendit_plan_id,
              params: {
                amount: new_plan.price_cents / 100.0,
                currency: new_plan.price_currency
              }
            )

            # Update local subscription to new plan
            subscription.update!(
              subscription_plan_id: new_plan.id,
              metadata: subscription.metadata.merge(
                "plan_change" => {
                  "old_plan_id" => old_plan_id.to_s,
                  "new_plan_id" => new_plan.id.to_s,
                  "changed_at" => now.iso8601,
                  "prorated_amount_cents" => proration[:prorated_amount_cents],
                  "action" => "upgrade"
                }
              )
            )

            # Update all upcoming pending billing cycles to use new plan's token allocation
            _ = step update_upcoming_cycles_tokens(subscription:, new_plan:)

            Success({
              prorated_cycle: prorated_cycle,
              note: "Plan upgrade applied with prorated cycle"
            })
          rescue StandardError => e
            Failure(error: "Failed to apply plan change: (#{e.class}) #{e.message}")
          end

          def update_upcoming_cycles_tokens(subscription:, new_plan:)
            # Find all billing cycles that start after now (future cycles)
            # Exclude prorated cycles (identified by decimal cycle_number like 1.1, 2.1, etc.)
            upcoming_cycles = subscription.billing_cycles
                                         .where("(span).lower > ?", Time.zone.now)
                                         .where("cycle_number = TRUNC(cycle_number)") # Exclude decimal cycle numbers (prorated cycles)

            # Update tokens_allocated for all upcoming cycles
            updated_count = upcoming_cycles.update_all(tokens_allocated: new_plan.token_limit)

            Rails.logger.info("Updated #{updated_count} upcoming billing cycles with new plan token allocation: #{new_plan.token_limit}")

            Success(updated_count: updated_count)
          rescue StandardError => e
            Rails.logger.error("Failed to update upcoming cycles tokens: #{e.message}")
            Failure(error: "Failed to update upcoming cycles tokens: #{e.message}")
          end

          def create_payment_for_proration(subscription:, prorated_cycle:, params:)
            return Success(nil) unless prorated_cycle.present?

            # Extract payment information from webhook params
            payment_id = params[:payment_id]

            # Get amount from params or from prorated cycle metadata
            # Amount in params is in currency units (e.g., 250 PHP), need to convert to cents
            amount_from_params = params[:amount]
            amount_cents = if amount_from_params.present?
                            (amount_from_params * 100).to_i
            else
                            prorated_cycle.metadata&.dig("prorated_amount_cents").to_i
            end

            currency = params[:currency].presence ||
              subscription.subscription_plan.price_currency.presence ||
              subscription.space.currency.presence ||
              "PHP"

            # Use payment_id as xendit_cycle_id for uniqueness
            # If no payment_id, use payment_session_id as fallback
            xendit_cycle_id = payment_id || "ps-#{SecureRandom.hex(8)}"

            # Create payment record
            payment = Finance::Payment.find_or_initialize_by(
              xendit_cycle_id: xendit_cycle_id
            )

            payment.assign_attributes(
              space_subscription: subscription,
              billing_cycle: prorated_cycle,
              xendit_reference_id: params[:reference_id],
              amount_cents: amount_cents,
              amount_currency: currency,
              status: "succeeded",
              paid_at: Time.zone.now,
              xendit_data: params.deep_stringify_keys,
              metadata: {
                type: "proration",
                payment_session_id: params[:id],
                payment_id: payment_id
              }
            )

            payment.save!

            # Mark the prorated cycle as paid
            prorated_cycle.update!(
              status: "paid",
              paid_at: payment.paid_at
            )

            Rails.logger.info("Created payment for prorated cycle: payment_id=#{payment.id}, cycle_id=#{prorated_cycle.id}, amount=#{amount_cents}")

            Success(payment)
          rescue StandardError => e
            Rails.logger.error("Failed to create payment for proration: #{e.message}")
            Failure(error: "Failed to create payment for proration: #{e.message}")
          end

          def clear_pending_change(subscription:)
            metadata = subscription.metadata.dup
            metadata.delete("pending_plan_change")

            subscription.update!(metadata: metadata)

            Success(true)
          end


          def broadcast_subscription_update(subscription:)
            # Broadcast to the space's subscription channel
            space_id = subscription.space_id

            ActionCable.server.broadcast(
              "subscriptions:#{space_id}",
              {
                type: "subscription_updated",
                subscription_id: subscription.id,
                space_id: space_id,
                message: "Subscription plan updated successfully"
              }
            )

            Rails.logger.info("Broadcasted subscription update for space #{space_id}")
          rescue StandardError => e
            Rails.logger.error("Failed to broadcast subscription update: #{e.message}")
          end
        end
      end
    end
  end
end
