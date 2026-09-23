# frozen_string_literal: true

class UseRevenuecatSlugsOnProPlans < ActiveRecord::Migration[8.1]
  def up
    Finance::SubscriptionPlan.reset_column_information
    Finance::SubscriptionPlan.sync_pro_catalog!
  end

  def down
    restore_slug(from: "pro_monthly", to: "pro")
    restore_slug(from: "pro_yearly", to: "pro-yearly")
  end

  private

  def restore_slug(from:, to:)
    plan = Finance::SubscriptionPlan.find_by(slug: from)
    return unless plan
    return if Finance::SubscriptionPlan.exists?(slug: to)

    plan.update!(slug: to)
  end
end
