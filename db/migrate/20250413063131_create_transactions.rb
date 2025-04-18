# frozen_string_literal: true

class CreateTransactions < ActiveRecord::Migration[8.0]
  def change
    create_table :transactions, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid, index: true
      t.date :date, null: false
      t.monetize :amount, null: false
      t.monetize :balance, null: false
      t.string :description
      t.string :type, null: false

      t.timestamps
    end

    add_index :transactions, [ :user_id, :date, :type ]
    add_index :transactions, [ :date, :type, :amount_currency, :amount_cents ]
  end
end
