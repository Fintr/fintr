# frozen_string_literal: true

class AddXenditCustomerToSpaces < ActiveRecord::Migration[8.1]
  def change
    add_column :spaces, :xendit_customer_id, :string
    add_column :spaces, :xendit_customer_reference_id, :string

    add_index :spaces, :xendit_customer_id
    add_index :spaces, :xendit_customer_reference_id
  end
end
