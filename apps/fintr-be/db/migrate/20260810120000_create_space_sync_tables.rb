# frozen_string_literal: true

class CreateSpaceSyncTables < ActiveRecord::Migration[8.1]
  def change
    create_table :space_sync_sequences, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid :space_id, null: false
      t.bigint :last_seq, null: false, default: 0
      t.timestamps
    end

    add_index :space_sync_sequences, :space_id, unique: true
    add_foreign_key :space_sync_sequences, :spaces

    create_table :space_change_log, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid :space_id, null: false
      t.bigint :seq, null: false
      t.string :op, null: false
      t.string :entity_type
      t.uuid :entity_id
      t.jsonb :payload, null: false, default: {}
      t.uuid :actor_user_id
      t.string :origin_client_mutation_id
      t.timestamps null: false
    end

    add_index :space_change_log,
              [ :space_id, :seq ],
              unique: true,
              name: "index_space_change_log_on_space_id_and_seq"
    add_index :space_change_log,
              [ :space_id, :created_at ],
              name: "index_space_change_log_on_space_id_and_created_at"
    add_index :space_change_log, :entity_id
    add_foreign_key :space_change_log, :spaces
    add_foreign_key :space_change_log, :users, column: :actor_user_id
  end
end
