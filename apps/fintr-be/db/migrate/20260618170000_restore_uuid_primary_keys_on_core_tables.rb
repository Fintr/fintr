# frozen_string_literal: true

# pg_restore (especially partial/schema-only restores) can load rows and indexes but omit
# PRIMARY KEY constraints. Rails then dumps those tables as +id: false+ even though an +id+
# uuid column exists — ActiveRecord cannot find a primary key.
#
# This migration is idempotent: it only adds a primary key when one is missing.
class RestoreUuidPrimaryKeysOnCoreTables < ActiveRecord::Migration[8.1]
  TABLES = Fintr::DatabaseUuidPrimaryKeyTables::TABLES

  def up
    TABLES.each do |table|
      restore_uuid_primary_key(table:)
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
          "Restored UUID primary keys must not be removed"
  end

  private

  def restore_uuid_primary_key(table:)
    return if primary_key_exists?(table:)

    quoted_table = quote_table_name(table)

    null_ids = select_value(<<~SQL.squish)
      SELECT COUNT(*) FROM #{quoted_table} WHERE id IS NULL
    SQL
    if null_ids.to_i.positive?
      raise "Cannot add primary key on #{table}: #{null_ids} row(s) have NULL id"
    end

    duplicate_ids = select_value(<<~SQL.squish)
      SELECT COUNT(*) FROM (
        SELECT id FROM #{quoted_table} GROUP BY id HAVING COUNT(*) > 1
      ) duplicates
    SQL
    if duplicate_ids.to_i.positive?
      total = select_value("SELECT COUNT(*) FROM #{quoted_table}")
      distinct = select_value("SELECT COUNT(DISTINCT id) FROM #{quoted_table}")
      raise(
        "Cannot add primary key on #{table}: #{duplicate_ids} duplicate id value(s) " \
        "(#{total} rows, #{distinct} distinct ids). Re-import the dump without duplicating data."
      )
    end

    execute <<~SQL.squish
      ALTER TABLE #{quoted_table} ADD PRIMARY KEY (id)
    SQL

    say "Added PRIMARY KEY (id) on #{table}"
  end

  def primary_key_exists?(table:)
    select_value(<<~SQL.squish).present?
      SELECT 1
      FROM pg_index
      WHERE indrelid = #{quote("#{table}")}::regclass
        AND indisprimary
      LIMIT 1
    SQL
  end
end
