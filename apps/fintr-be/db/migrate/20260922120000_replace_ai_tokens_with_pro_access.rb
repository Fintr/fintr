# frozen_string_literal: true

class ReplaceAiTokensWithProAccess < ActiveRecord::Migration[8.1]
  PRO_DESCRIPTION = "Dashboard Insights, AI receipt scanning, AI chat, and tag images. Bulk AI receipt scanning is coming soon."

  def up
    add_column :users, :trial_ends_at, :datetime
    add_index :users, :trial_ends_at

    execute <<~SQL.squish
      UPDATE users
      SET trial_ends_at = created_at + INTERVAL '7 days'
      WHERE trial_ends_at IS NULL
    SQL

    create_table :finance_revenuecat_customers, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid :user_id, null: false
      t.string :app_user_id, null: false
      t.boolean :pro_active, null: false, default: false
      t.datetime :pro_expires_at
      t.datetime :synced_at
      t.timestamps
    end

    add_index :finance_revenuecat_customers, :user_id, unique: true
    add_foreign_key :finance_revenuecat_customers, :users

    remove_column :finance_subscription_plans, :token_limit, :integer
    remove_column :finance_billing_cycles, :tokens_allocated, :integer
    remove_column :ai_usages, :tokens_used, :integer

    execute <<~SQL.squish
      INSERT INTO finance_subscription_plans (
        id, name, slug, description, interval, price_cents, price_currency, active, created_at, updated_at
      )
      SELECT
        gen_random_uuid(),
        'Pro',
        'pro',
        #{connection.quote(PRO_DESCRIPTION)},
        'month',
        29900,
        'PHP',
        true,
        NOW(),
        NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM finance_subscription_plans WHERE slug = 'pro'
      )
    SQL

    execute <<~SQL.squish
      UPDATE finance_subscription_plans
      SET
        description = #{connection.quote(PRO_DESCRIPTION)},
        active = true,
        updated_at = NOW()
      WHERE slug = 'pro'
    SQL

    execute <<~SQL.squish
      UPDATE finance_subscription_plans
      SET active = false, updated_at = NOW()
      WHERE slug <> 'pro'
    SQL
  end

  def down
    add_column :finance_subscription_plans, :token_limit, :integer, null: false, default: 1
    add_column :finance_billing_cycles, :tokens_allocated, :integer, null: false, default: 1
    add_column :ai_usages, :tokens_used, :integer, null: false, default: 1

    change_column_default :finance_subscription_plans, :token_limit, from: 1, to: nil
    change_column_default :finance_billing_cycles, :tokens_allocated, from: 1, to: nil
    change_column_default :ai_usages, :tokens_used, from: 1, to: nil

    drop_table :finance_revenuecat_customers
    remove_index :users, :trial_ends_at
    remove_column :users, :trial_ends_at, :datetime
  end
end
