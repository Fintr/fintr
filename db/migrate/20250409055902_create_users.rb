# frozen_string_literal: true

# Use Rails 7.0 for UUID support in migrations if needed, or adjust as per your Rails version
class CreateUsers < ActiveRecord::Migration[8.0] # Or your specific version
  def change
    # Add id: :uuid to specify UUID primary key
    create_table :users, id: :uuid do |t|
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
