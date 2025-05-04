# frozen_string_literal: true

class CreateSpaceUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :space_users, id: :uuid do |t|
      t.references :space, null: false, foreign_key: true, type: :uuid, index: true
      t.references :user, null: false, foreign_key: true, type: :uuid, index: true

      t.timestamps
    end

    add_index :space_users, [:space_id, :user_id], unique: true
  end
end
