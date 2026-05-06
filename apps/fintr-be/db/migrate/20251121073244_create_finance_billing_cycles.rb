# frozen_string_literal: true

class CreateFinanceBillingCycles < ActiveRecord::Migration[8.1]
  def change
    create_enum :finance_billing_cycle_status, %w[pending paid failed]

    create_table :finance_billing_cycles, id: :uuid do |t|
      t.references :space_subscription,
                   type: :uuid,
                   null: false,
                   foreign_key: { to_table: :finance_space_subscriptions }
      t.decimal   :cycle_number,
                    precision: 10,
                    scale: 1,
                    null: false,
                    default: 0.0
      t.tstzrange :span, null: false
      t.datetime  :paid_at
      t.enum :status,
             enum_type: :finance_billing_cycle_status,
             null: false,
             default: "pending"
      t.integer :tokens_allocated, null: false
      t.string :xendit_cycle_id, null: false
      t.jsonb :metadata, null: false, default: {}
      t.string :action_url, null: true
      t.datetime :scheduled_timestamp, null: true

      t.timestamps
    end

    add_index :finance_billing_cycles,
              [:space_subscription_id, :cycle_number],
              unique: true,
              name: "index_finance_billing_cycles_on_subscription_and_cycle"
    add_index :finance_billing_cycles,
              [:space_subscription_id, :status],
              name: "index_finance_billing_cycles_on_subscription_and_status"
    add_index :finance_billing_cycles,
              :xendit_cycle_id,
              unique: true,
              where: "xendit_cycle_id IS NOT NULL",
              name: "index_finance_billing_cycles_on_xendit_cycle_id"
    add_index :finance_billing_cycles,
              :span,
              using: :gist,
              name: "index_finance_billing_cycles_on_span"
  end
end
