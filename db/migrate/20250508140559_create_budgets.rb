# frozen_string_literal: true

class CreateBudgets < ActiveRecord::Migration[8.0]
  def change
    create_table :budgets, id: :uuid do |t|
      t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid, index: true
      t.references :category, null: false, foreign_key: { to_table: :transactions_categories }, type: :uuid, index: true
      t.monetize :amount, null: false
      t.monetize :spent, null: false
      t.date :date, null: false

      t.timestamps
    end

    add_index :budgets, [:space_id, :category_id, :date], unique: true
    add_index :budgets, [:amount_cents, :amount_currency]
    add_index :budgets, [:spent_cents, :spent_currency]
  end
end
