# frozen_string_literal: true

puts "Seeding subscription plans..."

plans = [
  {
    name: "Free",
    slug: "free",
    token_limit: 30,
    price_cents: 0,
    price_currency: "PHP",
    interval: "month",
    active: true,
    description: "Perfect for trying out Fintr. Includes 30 tokens per month for receipt scanning and AI chat."
  },
  {
    name: "Starter",
    slug: "starter",
    token_limit: 100,
    price_cents: 9_900,
    price_currency: "PHP",
    interval: "month",
    active: true,
    description: "Great for regular personal use. Includes 100 tokens per month - enough for ~100 receipt scans or ~33 AI chats."
  },
  {
    name: "Pro",
    slug: "pro",
    token_limit: 300,
    price_cents: 29_900,
    price_currency: "PHP",
    interval: "month",
    active: true,
    description: "Perfect for power users and small businesses. Includes 300 tokens per month - enough for ~300 receipt scans or ~100 AI chats. Includes priority support and advanced analytics."
  },
  {
    name: "Business",
    slug: "business",
    token_limit: 1_000,
    price_cents: 79_900,
    price_currency: "PHP",
    interval: "month",
    active: true,
    description: "Ideal for businesses and teams. Includes 1,000 tokens per month - enough for ~1,000 receipt scans or ~333 AI chats. Includes multi-user support, team analytics, and API access."
  }
]

plans.each do |plan_attrs|
  plan = Finance::SubscriptionPlan.find_or_initialize_by(slug: plan_attrs[:slug])
  plan.assign_attributes(plan_attrs)
  plan.save!
  puts "  ✓ #{plan.name} plan (#{plan.slug})"
end

puts "Subscription plans seeded successfully."




