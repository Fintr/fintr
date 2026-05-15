# frozen_string_literal: true

# Removes +schema_migrations+ rows for migrations that were deleted from the repo, then recreates
# +combined_transactions+ from Scenic version 2 (+db/views/combined_transactions_v02.sql+).
class ResetCombinedTransactionsViewAndCleanupRemovedMigrations < ActiveRecord::Migration[8.0]
  def up
    execute <<~SQL.squish
      DELETE FROM schema_migrations
      WHERE version IN (
        '20260515120000',
        '20260516145949',
        '20260516150000'
      )
    SQL

    if connection.views.include?("combined_transactions")
      drop_view :combined_transactions, revert_to_version: 2
    end

    create_view :combined_transactions, version: 2
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
