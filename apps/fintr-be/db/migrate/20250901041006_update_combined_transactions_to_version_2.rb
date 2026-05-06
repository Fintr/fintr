# frozen_string_literal: true

class UpdateCombinedTransactionsToVersion2 < ActiveRecord::Migration[8.0]
  def change
    replace_view :combined_transactions, version: 2, revert_to_version: 1
  end
end
