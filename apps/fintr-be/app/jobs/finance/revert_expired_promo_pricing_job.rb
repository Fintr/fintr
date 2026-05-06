# frozen_string_literal: true

module Finance
  class RevertExpiredPromoPricingJob < ApplicationJob
    queue_as :default

    def perform
      # Find all active subscriptions with expired promo pricing
      expired_promo_subscriptions = Finance::SpaceSubscription
        .where(status: ["active", "pending"])
        .where("metadata->>'promo_expires_at' IS NOT NULL")
        .where("metadata->>'promo_expires_at' <= ?", Time.current.iso8601)
        .where("metadata->>'promo_reverted' IS NULL") # Not yet reverted

      expired_promo_subscriptions.find_each do |subscription|
        revert_promo_pricing(subscription)
      end
    end

    private

    def revert_promo_pricing(subscription)
      # Get original amount from metadata
      original_amount_cents = subscription.metadata.dig("discount_applied", "original_amount_cents")
      promo_expires_at = subscription.metadata["promo_expires_at"]

      unless original_amount_cents
        Rails.logger.warn "[RevertPromoPricing] No original_amount_cents found for subscription #{subscription.id}"
        return
      end

      # Update Xendit subscription amount
      client = Integrations::Payments::Xendit::Client.new

      # Calculate new amount (revert to original)
      new_amount = original_amount_cents / 100.0

      # Update the subscription plan in Xendit
      update_params = {
        amount: new_amount,
        metadata: {
          promo_reverted: true,
          promo_reverted_at: Time.current.iso8601,
          promo_expires_at: promo_expires_at,
          original_amount_cents: original_amount_cents
        }
      }

      response = client.update_subscription_plan(
        plan_id: subscription.xendit_plan_id,
        params: update_params
      )

      # Update local subscription metadata
      subscription.metadata["promo_reverted"] = true
      subscription.metadata["promo_reverted_at"] = Time.current.iso8601
      subscription.metadata["promo_reverted_job_id"] = self.job_id
      subscription.metadata["xendit_update_response"] = response
      subscription.save!

      Rails.logger.info "[RevertPromoPricing] Reverted promo pricing for subscription #{subscription.id}. New amount: #{new_amount}"

      # Notify user about pricing change
      notify_user_of_pricing_change(subscription, original_amount_cents)
    rescue Integrations::Payments::Xendit::Error => e
      Rails.logger.error "[RevertPromoPricing] Xendit error for subscription #{subscription.id}: #{e.message}"
      # Mark as failed so we can retry
      subscription.metadata["promo_revert_failed"] = true
      subscription.metadata["promo_revert_error"] = e.message
      subscription.save!
    rescue StandardError => e
      Rails.logger.error "[RevertPromoPricing] Error for subscription #{subscription.id}: #{e.message}"
      raise # Re-raise for job retry
    end

    def notify_user_of_pricing_change(subscription, original_amount_cents)
      # This could be implemented to send email/push notification
      # For now, we just log it
      user = subscription.space.owner
      return unless user

      Rails.logger.info "[RevertPromoPricing] Notifying user #{user.email} about pricing change for subscription #{subscription.id}"
    end
  end
end
