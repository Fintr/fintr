# frozen_string_literal: true

class AddSubscriptionSnapshotToRevenuecatCustomers < ActiveRecord::Migration[8.1]
  def change
    change_table :finance_revenuecat_customers, bulk: true do |t|
      t.string :revenuecat_subscription_id
      t.string :store
      t.string :product_identifier
      t.string :auto_renewal_status
      t.string :subscription_status
      t.boolean :gives_access, null: false, default: false
      t.datetime :starts_at
      t.datetime :current_period_ends_at
      t.string :management_url
    end
  end
end
