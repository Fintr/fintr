# frozen_string_literal: true

class SetProMonthlyAndYearlyPrices < ActiveRecord::Migration[8.1]
  def up
    Finance::SubscriptionPlan.reset_column_information
    Finance::SubscriptionPlan.sync_pro_catalog!
  end

  def down
    monthly = Finance::SubscriptionPlan.find_by(slug: "pro")
    monthly&.update!(
      name: "Pro",
      price_cents: 29_900,
      interval: "month",
      active: true,
    )

    Finance::SubscriptionPlan.where(slug: "pro-yearly").update_all(
      active: false,
      updated_at: Time.current,
    )
  end
end
