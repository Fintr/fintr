# frozen_string_literal: true

class CreateTransfers < ActiveRecord::Migration[8.0]
  def change
    create_table :transfers, id: :uuid do |t|
      t.references :user, null: false, foreign_key: { to_table: :users }, type: :uuid, index: true
      t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid, index: true
      t.references :from_account, null: false, foreign_key: { to_table: :accounts }, type: :uuid, index: true
      t.references :to_account, null: false, foreign_key: { to_table: :accounts }, type: :uuid, index: true
      t.references :parent, null: true, foreign_key: { to_table: :transfers }, type: :uuid, index: true
      t.monetize :amount, null: false
      t.monetize :transaction_cost, null: false
      t.datetime :date, null: false
      t.string :description
      t.jsonb :schedule, default: {}, null: true
      t.enum :schedule_type, null: false, enum_type: :schedule_type
      t.enum :repeat_interval, enum_type: :repeat_interval
      t.integer :repeat_count
      t.enum :balance_state, null: false, enum_type: :balance_state, default: "pending"

      t.timestamps
    end

    add_index :transfers, [:user_id, :date]
    add_index :transfers, [:space_id, :date]
    add_index :transfers, [:from_account_id, :date]
    add_index :transfers, [:from_account_id, :to_account_id]
    add_index :transfers, [:to_account_id, :date]
    add_index :transfers, [:parent_id, :date]
  end
end
