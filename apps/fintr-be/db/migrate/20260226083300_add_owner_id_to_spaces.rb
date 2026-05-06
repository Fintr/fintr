# frozen_string_literal: true

class AddOwnerIdToSpaces < ActiveRecord::Migration[8.1]
  def change
    add_reference :spaces, :owner, type: :uuid, foreign_key: { to_table: :users }, index: true
  end
end
