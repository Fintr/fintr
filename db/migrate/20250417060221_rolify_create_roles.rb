# frozen_string_literal: true

class RolifyCreateRoles < ActiveRecord::Migration[8.0]
  def change
    create_table :roles, id: :uuid do |t|
      t.string :name
      t.references :resource, polymorphic: true, type: :uuid

      t.timestamps
    end

    create_table(:auth_users_auth_roles, id: false) do |t|
      t.references :user, type: :uuid, foreign_key: { to_table: :users }
      t.references :role, type: :uuid, foreign_key: { to_table: :roles }
    end

    add_index(:roles, [ :name, :resource_type, :resource_id ])
    add_index(:auth_users_auth_roles, [ :user_id, :role_id ])
  end
end
