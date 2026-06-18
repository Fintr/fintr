# frozen_string_literal: true

class UpdateCombinedTransactionsToVersion3 < ActiveRecord::Migration[8.1]
  def up
    drop_view :combined_transactions, revert_to_version: 2
    create_view :combined_transactions, version: 3
  end

  def down
    drop_view :combined_transactions, revert_to_version: 3
    create_view :combined_transactions, version: 2
  end
end
