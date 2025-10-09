# frozen_string_literal: true

namespace :db do
  desc "Clean TimescaleDB schemas from schema files"
  task clean_timescaledb_schemas: :environment do
    schema_files = %w[
      db/schema.rb
      db/cache_schema.rb
      db/queue_schema.rb
      db/cable_schema.rb
    ]

    timescaledb_schemas = %w[
      _timescaledb_cache
      _timescaledb_catalog
      _timescaledb_config
      _timescaledb_debug
      _timescaledb_functions
      _timescaledb_internal
      timescaledb_experimental
      timescaledb_information
      toolkit_experimental
    ]

    schema_files.each do |file_path|
      next unless File.exist?(file_path)

      content = File.read(file_path)

      # Remove create_schema lines for TimescaleDB schemas
      timescaledb_schemas.each do |schema|
        content.gsub!(/^\s*create_schema "#{Regexp.escape(schema)}"\s*$/, "")
      end

      # Clean up formatting: remove multiple consecutive empty lines but preserve single empty lines
      content.gsub!(/\n\s*\n\s*\n+/, "\n\n")

      # Ensure there's a blank line before the extensions comment if TimescaleDB schemas were removed
      content.gsub!(/(\n)(\s*# These are extensions)/, "\n\n\\2")

      File.write(file_path, content)
      puts "Cleaned TimescaleDB schemas from #{file_path}"
    end
  end

  # Override the schema:dump task to automatically clean schemas
  task "schema:dump" => "clean_timescaledb_schemas"
end
