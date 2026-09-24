# frozen_string_literal: true

namespace :subscription_plans do
  desc "Create or update the monthly and yearly Fintr Pro plans (idempotent)"
  task create_or_update: :environment do
    puts "Creating/updating Pro plans..."

    Finance::SubscriptionPlan.sync_pro_catalog!

    Finance::SubscriptionPlan.active.order(:price_cents).each do |plan|
      price = plan.price_cents / 100
      puts "  ✓ #{plan.name} (#{plan.slug}) - ₱#{price}/#{plan.interval}"
    end
  end
end
