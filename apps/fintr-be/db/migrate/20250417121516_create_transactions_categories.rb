# frozen_string_literal: true

class CreateTransactionsCategories < ActiveRecord::Migration[8.0]
  # Define the enum type name (still good practice)
  CATEGORY_TYPE_ENUM = :category_type_enum

  def change
    # Use the gem's create_enum helper
    create_enum CATEGORY_TYPE_ENUM, %w[income expense]

    create_table :transactions_categories, id: :uuid do |t|
      t.references :space, null: false, foreign_key: true, type: :uuid
      t.string :name, null: false
      t.enum :category_type, enum_type: CATEGORY_TYPE_ENUM, null: false

      t.timestamps
    end

    add_index :transactions_categories, [:space_id, :category_type, :name], unique: true, name: 'index_tx_categories_on_space_type_name'

    add_reference :transactions, :category, null: false, foreign_key: { to_table: :transactions_categories }, type: :uuid
  end
end
