# frozen_string_literal: true

namespace :dev do
  desc "Grant an active paid (pro-tier) subscription to a user's spaces. Usage: rake dev:grant_pro[email@example.com]"
  task :grant_pro, [:email] => :environment do |_task, args|
    email = args[:email]&.strip
    if email.blank?
      puts "Usage: rake dev:grant_pro[email@example.com]"
      exit 1
    end

    user = Auth::User.find_by(email: email)
    unless user
      puts "No user found for #{email}"
      exit 1
    end

    plan = Finance::SubscriptionPlan
           .where(active: true)
           .order(token_limit: :desc)
           .first

    unless plan
      puts "No active subscription plan found. Run subscription_plans:create_or_update or db:seed."
      exit 1
    end

    user.spaces.find_each do |space|
      blocking = Finance::SpaceSubscription
                 .where(space_id: space.id, status: %w[active pending requires_action])
                 .first

      if blocking
        puts "  ⊘ #{space.name} (#{space.code}) — already has #{blocking.status} #{blocking.subscription_plan.slug}"
        next
      end

      subscription = Finance::SpaceSubscription.create!(
        space:,
        subscription_plan: plan,
        subscription_type: :paid,
        status: :active,
        started_at: Time.current,
        current_cycle_count: 1,
        metadata: {
          dev_grant: true,
          granted_at: Time.zone.now.iso8601,
          granted_to: email,
        },
        xendit_plan_id: "dev-grant-#{SecureRandom.uuid}",
        xendit_customer_id: "dev-grant-#{SecureRandom.uuid}",
        xendit_schedule_id: "dev-grant-#{SecureRandom.uuid}",
      )

      Finance::BillingCycle.create!(
        space_subscription: subscription,
        cycle_number: 1.0,
        span: (Time.current..1.month.from_now),
        status: :paid,
        tokens_allocated: plan.token_limit,
        paid_at: Time.current,
        metadata: { dev_grant: true },
      )

      puts "  ✓ #{space.name} (#{space.code}) — #{plan.name} (#{plan.slug}), #{plan.token_limit} tokens"
    end

    puts "Done. Refresh subscriptions in the app."
  end
end
