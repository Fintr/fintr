# frozen_string_literal: true

class CreateSyncClientMutations < ActiveRecord::Migration[8.1]
  def change
    create_table :sync_client_mutations, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.uuid :space_id, null: false
      t.string :client_mutation_id, null: false
      t.string :resource_type, null: false
      t.uuid :resource_id, null: false
      t.jsonb :response_snapshot, null: false, default: {}
      t.timestamps
    end

    add_index :sync_client_mutations,
              [ :space_id, :client_mutation_id ],
              unique: true,
              name: "index_sync_client_mutations_on_space_and_client_mutation"
    add_index :sync_client_mutations, :resource_id
    add_foreign_key :sync_client_mutations, :spaces
  end
end
