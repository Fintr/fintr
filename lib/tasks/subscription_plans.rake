# frozen_string_literal: true

namespace :subscription_plans do
  desc "Create or update subscription plans (idempotent)"
  task create_or_update: :environment do
    puts "Creating/updating subscription plans..."

    plans = [
      {
        name: "Basic",
        slug: "basic",
        token_limit: 50,
        price_cents: 14_900,
        price_currency: "PHP",
        interval: "month",
        active: true,
        description: "Basic plan with 50 credits per month for receipt scanning and AI chat."
      },
      {
        name: "Standard",
        slug: "standard",
        token_limit: 100,
        price_cents: 25_000,
        price_currency: "PHP",
        interval: "month",
        active: true,
        description: "Standard plan with 100 credits per month for receipt scanning and AI chat."
      },
      {
        name: "Premium",
        slug: "premium",
        token_limit: 250,
        price_cents: 39_900,
        price_currency: "PHP",
        interval: "month",
        active: true,
        description: "Premium plan with 250 credits per month for receipt scanning and AI chat."
      }
    ]

    plans.each do |plan_attrs|
      plan = Finance::SubscriptionPlan.find_or_initialize_by(slug: plan_attrs[:slug])
      plan.assign_attributes(plan_attrs)
      
      if plan.save
        action = plan.persisted? ? "Updated" : "Created"
        price_formatted = (plan.price_cents / 100.0).to_i
        puts "  ✓ #{action} #{plan.name} plan (#{plan.slug}) - ₱#{price_formatted} - #{plan.token_limit} credits"
      else
        puts "  ✗ Failed to save #{plan_attrs[:name]} plan: #{plan.errors.full_messages.join(', ')}"
      end
    end

    puts "Subscription plans task completed."
  end
end

