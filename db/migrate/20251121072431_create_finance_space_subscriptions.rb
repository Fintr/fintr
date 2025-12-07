# frozen_string_literal: true

class CreateFinanceSpaceSubscriptions < ActiveRecord::Migration[8.1]
  def change
    create_enum :finance_space_subscription_status, %w[requires_action pending active inactive]

    create_table :finance_space_subscriptions, id: :uuid do |t|
      t.references :space, type: :uuid, null: false, foreign_key: { to_table: :spaces }
      t.references :subscription_plan, type: :uuid, null: false, foreign_key: { to_table: :finance_subscription_plans }
      t.string :xendit_plan_id
      t.string :xendit_reference_id
      t.string :xendit_customer_id
      t.string :xendit_customer_reference_id
      t.string :xendit_schedule_id
      t.string :xendit_schedule_reference_id
      t.enum :status, enum_type: :finance_space_subscription_status, null: false, default: "pending"
      t.datetime :started_at
      t.datetime :ended_at
      t.integer :current_cycle_count, null: false, default: 0
      t.integer :total_cycles
      t.jsonb :metadata, null: false, default: {}
      t.datetime :cancelled_at, null: true

      t.timestamps
    end

    add_index :finance_space_subscriptions, :xendit_plan_id
    add_index :finance_space_subscriptions, :xendit_reference_id
    add_index :finance_space_subscriptions, :xendit_customer_reference_id
    add_index :finance_space_subscriptions, :status
    add_index :finance_space_subscriptions, [:space_id, :status], where: "status = 'active'", unique: true
    add_index :finance_space_subscriptions,
              :cancelled_at,
              where: "cancelled_at IS NOT NULL",
              name: "index_finance_space_subscriptions_on_cancelled_at"
  end
end
