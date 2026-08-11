# frozen_string_literal: true

class AddIsDefaultToTransactionsTags < ActiveRecord::Migration[8.0]
  def change
    add_column :transactions_tags, :is_default, :boolean, null: false, default: false

    add_index :transactions_tags,
              :space_id,
              unique: true,
              where: "is_default = true",
              name: "index_transactions_tags_on_space_id_default"
  end
end
