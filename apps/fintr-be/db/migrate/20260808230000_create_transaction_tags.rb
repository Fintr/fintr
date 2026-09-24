# frozen_string_literal: true

class CreateTransactionTags < ActiveRecord::Migration[8.0]
  def change
    create_table :transactions_tags, id: :uuid do |t|
      t.uuid :space_id, null: false
      t.string :name, null: false
      t.string :color, null: false

      t.timestamps
    end

    add_index :transactions_tags,
              %i[space_id name],
              unique: true,
              name: "index_transactions_tags_on_space_id_and_name"
    add_foreign_key :transactions_tags, :spaces

    create_table :transaction_taggings, id: false do |t|
      t.uuid :transaction_id, null: false
      t.uuid :tag_id, null: false
    end

    add_index :transaction_taggings,
              %i[transaction_id tag_id],
              unique: true,
              name: "index_transaction_taggings_on_transaction_id_and_tag_id"
    add_index :transaction_taggings, :tag_id
    add_foreign_key :transaction_taggings, :transactions
    add_foreign_key :transaction_taggings, :transactions_tags, column: :tag_id
  end
end
