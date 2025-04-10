# frozen_string_literal: true

class AddAuth0FieldsToUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.string :auth0_id, null: false, unique: true
      t.string :first_name, null: false
      t.string :last_name, null: false
      t.string :email, null: false, unique: true

      t.timestamps
    end

    add_index :users, :auth0_id, unique: true
  end
end
