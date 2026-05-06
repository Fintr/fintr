# frozen_string_literal: true

class CreateAccounts < ActiveRecord::Migration[8.0]
  def change
    create_enum :account_category, ["cash", "savings", "debit", "credit_card", "e_wallet", "loan", "investment"]

    create_table :accounts, id: :uuid do |t|
      t.references :space, null: false, foreign_key: true, type: :uuid
      t.string :name, null: false
      t.monetize :balance, null: false
      t.enum :account_category, null: false, enum_type: :account_category

      t.timestamps
    end

    add_index :accounts, [:space_id, :name], unique: true

    add_reference :transactions, :account, null: false, foreign_key: true, type: :uuid
  end
end
