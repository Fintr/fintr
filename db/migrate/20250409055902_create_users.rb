# frozen_string_literal: true

class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string :auth_id, null: false
      t.string :full_name
      t.string :email
      t.string :photo_url

      t.timestamps
    end

    add_index :users, :auth_id, unique: true
    add_index :users, :email, unique: true
  end
end
