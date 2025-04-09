# frozen_string_literal: true

class CreateTransactions < ActiveRecord::Migration[8.0]
  def change
    create_enum :transaction_type, %w[income expense]
    create_enum :expense_category, %w[house food transportation utilities insurance family pet socials entertainment travel business]
    create_enum :income_category, %w[salary freelance business]
    create_enum :transaction_essentialness, %w[want need]

    create_table :transactions do |t|
      t.references :user, null: false, foreign_key: true, index: true
      t.date :date, null: false
      t.decimal :amount, precision: 15, scale: 2, null: false
      t.decimal :balance, precision: 15, scale: 2, null: false
      t.string :description
      t.enum :transaction_type, enum_type: :transaction_type, null: false
      t.enum :expense_category, enum_type: :expense_category
      t.enum :income_category, enum_type: :income_category
      t.enum :essentialness, enum_type: :transaction_essentialness, null: false, default: 'want'

      t.timestamps
    end

    add_index :transactions, [ :user_id, :date, :transaction_type ]
    add_index :transactions, [ :transaction_type, :expense_category ]
    add_index :transactions, [ :transaction_type, :income_category ]
  end
end
