# frozen_string_literal: true

class CreateTransactions < ActiveRecord::Migration[8.0]
  def change
    create_enum :schedule_type, [ "one_time", "repeat", "installment" ]
    create_enum :repeat_interval, [ "every_day", "every_week", "every_2_weeks", "every_month", "every_2_months", "every_3_months", "every_6_months", "every_year" ]
    create_enum :balance_state, [ "pending", "calculated" ]

    create_table :transactions, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid, index: true
      t.references :parent, null: true, foreign_key: { to_table: :transactions }, type: :uuid, index: true
      t.datetime :date, null: false
      t.monetize :amount, null: false
      t.monetize :balance, null: true
      t.string :description
      t.string :type, null: false
      t.enum :schedule_type, null: false, enum_type: :schedule_type
      t.enum :repeat_interval, enum_type: :repeat_interval
      t.enum :balance_state, null: false, enum_type: :balance_state
      t.integer :repeat_count
      t.integer :installment_period
      t.integer :installment_count
      t.jsonb :schedule, default: {}, null: true

      t.timestamps
    end

    add_index :transactions, [ :user_id, :date, :type ]
    add_index :transactions, [ :date, :type, :amount_currency, :amount_cents ]
  end
end
