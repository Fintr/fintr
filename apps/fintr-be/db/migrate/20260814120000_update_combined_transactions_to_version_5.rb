# frozen_string_literal: true

class UpdateCombinedTransactionsToVersion5 < ActiveRecord::Migration[8.1]
  def up
    drop_view :combined_transactions, revert_to_version: 4
    create_view :combined_transactions, version: 5
  end

  def down
    drop_view :combined_transactions, revert_to_version: 5
    create_view :combined_transactions, version: 4
  end
end
