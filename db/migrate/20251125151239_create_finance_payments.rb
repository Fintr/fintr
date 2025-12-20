# frozen_string_literal: true

class CreateFinancePayments < ActiveRecord::Migration[8.1]
  def change
    create_enum :finance_payment_status, %w[pending succeeded failed refunded]

    create_table :finance_payments, id: :uuid do |t|
      t.references :space_subscription,
                    type: :uuid,
                    null: false,
                    foreign_key: { to_table: :finance_space_subscriptions }
      t.references :biling_cycle,
                    type: :uuid,
                    null: false,
                    foreign_key: { to_table: :finance_billing_cycles }

      t.string :xendit_cycle_id, null: false
      t.string :xendit_reference_id, null: false
      t.bigint :amount_cents, null: false
      t.string :amount_currency, null: false, default: "PHP"
      t.enum :status, enum_type: :finance_payment_status, null: false, default: "pending"
      t.string :payment_method_type
      t.string :payment_method_id
      t.datetime :paid_at
      t.datetime :failed_at
      t.text :failure_reason
      t.jsonb :xendit_data, null: false, default: {}
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :finance_payments, :xendit_cycle_id, unique: true
    add_index :finance_payments, :status
    add_index :finance_payments, :paid_at
  end
end
