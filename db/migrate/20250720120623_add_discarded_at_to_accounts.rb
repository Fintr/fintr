# frozen_string_literal: true

class AddDiscardedAtToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :discarded_at, :datetime
    add_index :accounts, :discarded_at
    remove_index :accounts, [:space_id, :name], unique: true
    add_index :accounts, [:space_id, :name], unique: true, where: "discarded_at IS NULL", name: "index_accounts_on_space_id_and_name_where_not_discarded"
  end
end
