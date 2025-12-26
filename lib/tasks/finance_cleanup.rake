# frozen_string_literal: true

namespace :finance do
  desc "Clean all finance-related records (payments, payment methods, billing cycles, space subscriptions)"
  task clean: :environment do
    puts "Cleaning finance-related records..."

    # Delete in order to respect foreign key constraints:
    # 1. Payments (depends on billing_cycles and space_subscriptions)
    # 2. Billing cycles (depends on space_subscriptions)
    # 3. Space subscriptions (depends on spaces and subscription_plans)
    # 4. Payment methods (depends on spaces)

    payments_count = Finance::Payment.count
    Finance::Payment.delete_all
    puts "  ✓ Deleted #{payments_count} payment(s)"

    billing_cycles_count = Finance::BillingCycle.count
    Finance::BillingCycle.delete_all
    puts "  ✓ Deleted #{billing_cycles_count} billing cycle(s)"

    space_subscriptions_count = Finance::SpaceSubscription.count
    Finance::SpaceSubscription.delete_all
    puts "  ✓ Deleted #{space_subscriptions_count} space subscription(s)"

    puts "Finance cleanup completed."
  end
end
