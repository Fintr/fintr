# frozen_string_literal: true

class CreateImports < ActiveRecord::Migration[8.1]
  def change
    create_table :imports, id: :uuid do |t|
      t.references :user, null: false, foreign_key: { to_table: :users }, type: :uuid
      t.references :space, null: false, foreign_key: { to_table: :spaces }, type: :uuid
      t.string :status, null: false, default: "pending" # pending, processing, completed, failed, reverted
      t.string :import_location, null: false # "onboarding", "settings"
      t.integer :total_rows_read, default: 0
      t.integer :total_rows_inserted, default: 0
      t.integer :total_rows_failed, default: 0
      t.jsonb :import_errors, default: []
      t.jsonb :metadata, default: {}
      t.datetime :processed_at

      t.timestamps

      t.index [:user_id, :created_at]
      t.index [:space_id, :created_at]
      t.index :status
    end
  end
end
