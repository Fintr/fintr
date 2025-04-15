# frozen_string_literal: true

class CreateTransactions < ActiveRecord::Migration[8.0]
  def change
    create_table :transactions do |t|
      t.references :user, null: false, foreign_key: true, index: true
      t.date :date, null: false
      t.monetize :amount, null: false
      t.monetize :balance, null: false
      t.string :description
      t.string :type

      t.timestamps
    end

    add_index :transactions, [ :user_id, :date, :type ]
    add_index :transactions, [ :type, :date, :amount_cents ]
    add_index :transactions, [ :type, :date, :balance_cents ]
  end
end
