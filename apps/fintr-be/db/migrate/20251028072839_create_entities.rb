# frozen_string_literal: true

class CreateEntities < ActiveRecord::Migration[8.0]
  def change
    create_table :entities, id: :uuid do |t|
      t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid
      t.string :full_name, null: false
      t.string :entity_type, null: false, default: 'loan'

      t.timestamps
    end

    add_index :entities, [:space_id, :entity_type, :full_name], unique: true, name: 'index_entities_on_space_entity_type_full_name'
    add_index :entities, [:space_id, :entity_type]
  end
end
