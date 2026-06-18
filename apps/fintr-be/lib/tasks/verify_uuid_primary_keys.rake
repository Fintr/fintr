# frozen_string_literal: true

namespace :db do
  desc "Verify core tables with an id column declare a UUID primary key (fails if missing)"
  task verify_uuid_primary_keys: :environment do
  tables = Fintr::DatabaseUuidPrimaryKeyTables::TABLES
  connection = ActiveRecord::Base.connection
  missing = []

  tables.each do |table|
    next unless connection.table_exists?(table)
    next unless connection.column_exists?(table, :id)

    has_pk = connection.select_value(<<~SQL.squish).present?
      SELECT 1
      FROM pg_index
      WHERE indrelid = #{connection.quote(table)}::regclass
        AND indisprimary
      LIMIT 1
    SQL

    missing << table unless has_pk
  end

  if missing.any?
    abort <<~MSG
      Missing PRIMARY KEY on id for: #{missing.join(", ")}

      This usually happens after a pg_restore that did not restore constraints.
      Run: bundle exec rails db:migrate
      (migration RestoreUuidPrimaryKeysOnCoreTables adds PKs when missing)
    MSG
  end

  puts "UUID primary keys verified on #{tables.size} core table(s)"
  end
end
