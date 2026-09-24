# frozen_string_literal: true

puts "Seeding subscription plans..."

Finance::SubscriptionPlan.sync_pro_catalog!

Finance::SubscriptionPlan.active.order(:price_cents).each do |plan|
  price = plan.price_cents / 100
  puts "  ✓ #{plan.name} (#{plan.slug}) - ₱#{price}/#{plan.interval}"
end

puts "Subscription plans seeded successfully."
