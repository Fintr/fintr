# frozen_string_literal: true

class CreateEntityMerchantAliases < ActiveRecord::Migration[8.1]
  def change
    create_table :entity_merchant_aliases, id: :uuid do |t|
      t.references :space,
                   null: false,
                   foreign_key: { to_table: :spaces },
                   type: :uuid
      t.references :entity,
                   null: false,
                   foreign_key: { to_table: :entities },
                   type: :uuid
      t.string :scanned_name, null: false

      t.timestamps
    end

    add_index :entity_merchant_aliases,
              %i[space_id scanned_name],
              unique: true,
              name: "index_entity_merchant_aliases_on_space_and_scanned_name"
  end
end
