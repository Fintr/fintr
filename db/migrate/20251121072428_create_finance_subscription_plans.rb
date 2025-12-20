# frozen_string_literal: true

class CreateFinanceSubscriptionPlans < ActiveRecord::Migration[8.1]
  def change
    create_table :finance_subscription_plans, id: :uuid do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.integer :token_limit, null: false
      t.bigint :price_cents, null: false, default: 0
      t.string :price_currency, null: false, default: "PHP"
      t.string :interval, null: false, default: "month"
      t.boolean :active, null: false, default: true
      t.text :description

      t.timestamps
    end

    add_index :finance_subscription_plans, :slug, unique: true
    add_index :finance_subscription_plans, :active
  end
end
