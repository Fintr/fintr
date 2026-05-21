# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Imports
  module Operations
    class PrepareCategories < Dry::Operation
      include ::FailureHandler
      include Dry::Operation::Extensions::ActiveRecord

      def call(params)
        space_id = params[:space_id]
        rows_data = params[:rows_data]
        import = params[:import]

        # Validate rows_data
        unless rows_data.is_a?(Array)
          return Failure(error: "Invalid file data: rows_data must be an array")
        end

        # Extract unique categories from all rows
        unique_categories = extract_unique_categories(rows_data:)

        # Find existing categories
        existing_categories = find_existing_categories(
          space_id: space_id,
          unique_categories: unique_categories
        )

        # Create missing categories
        new_categories = create_missing_categories(
          space_id: space_id,
          unique_categories: unique_categories,
          existing_categories: existing_categories
        )

        # Create import records for new categories
        create_category_import_records(
          import: import,
          new_categories: new_categories
        ) if import && new_categories.any?

        # Build category lookup map
        category_map = build_category_map(
          existing_categories: existing_categories,
          new_categories: new_categories
        )

        {
          category_map: category_map,
          new_categories: new_categories
        }
      end

      private

      def extract_unique_categories(rows_data:)
        categories = {}
        rows_data.each do |row_info|
          row = row_info[:data]
          category_name = row[4]&.to_s&.strip
          category_type = row[3]&.to_s&.strip&.downcase

          next if category_name.blank? || category_type.blank?

          key = "#{category_type}:#{category_name}"
          categories[key] = {
            name: category_name,
            category_type: category_type
          }
        end
        categories.values
      end

      def find_existing_categories(space_id:, unique_categories:)
        return [] if unique_categories.empty?

        category_conditions = unique_categories.map do |cat|
          {
            space_id: space_id,
            name: cat[:name],
            category_type: cat[:category_type]
          }
        end

          # Eagerly load the relation to execute the query immediately
          # This prevents transaction errors when iterating over the result later
          Transactions::Category
            .where(parent_id: nil)
            .where(
              category_conditions.map { |c| "(space_id = ? AND name = ? AND category_type = ?)" }
                .join(" OR "),
              *category_conditions.flat_map { |c| [c[:space_id], c[:name], c[:category_type]] }
            )
            .to_a
      end

      def create_missing_categories(space_id:, unique_categories:, existing_categories:)
        existing_keys = existing_categories.map { |c| "#{c.category_type}:#{c.name}" }.to_set
        missing = unique_categories.reject { |c| existing_keys.include?("#{c[:category_type]}:#{c[:name]}") }

        return [] if missing.empty?

        categories_to_create = missing.map do |cat|
          Transactions::Category.new(
            space_id: space_id,
            name: cat[:name],
            category_type: cat[:category_type],
            parent_id: nil
          )
        end

        begin
          # Use activerecord-import to bulk create categories
          Transactions::Category.import(
            categories_to_create,
            on_duplicate_key_update: {
              conflict_target: [:space_id, :category_type, :name],
              index_predicate: "(parent_id IS NULL)",
              columns: []
            },
            validate: false
          )

          # Reload to get the created categories with IDs
          # Eagerly load to execute query immediately and avoid transaction errors
          missing_names = missing.map { |c| c[:name] }
          missing_types = missing.map { |c| c[:category_type] }
          Transactions::Category.where(
            space_id: space_id,
            name: missing_names,
            category_type: missing_types
          ).to_a
        rescue ActiveRecord::StatementInvalid, PG::Error => e
          Rails.logger.error("Failed to bulk create categories: #{e.message}\n#{e.backtrace.join("\n")}")
          # Fallback: create categories one by one with race condition handling
          create_categories_with_retry(space_id: space_id, missing: missing)
        end
      rescue StandardError => e
        Rails.logger.error("Failed to create categories: #{e.message}\n#{e.backtrace.join("\n")}")
        # Fallback: create categories one by one with race condition handling
        begin
          create_categories_with_retry(space_id: space_id, missing: missing)
        rescue StandardError => e
          Rails.logger.error("Failed to create categories with retry: #{e.message}\n#{e.backtrace.join("\n")}")
          raise StandardError.new("Failed to create category: invalid input value for category type, should only be 'expense' or 'income'")
        end
      end

      def create_categories_with_retry(space_id:, missing:)
        created = []
        missing.each do |cat|
          begin
            category = Transactions::Category.create!(
              space_id: space_id,
              name: cat[:name],
              category_type: cat[:category_type],
              parent_id: nil
            )
            created << category
          rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid
            # Race condition: category was created by another process
            category = Transactions::Category.find_by!(
              space_id: space_id,
              name: cat[:name],
              category_type: cat[:category_type],
              parent_id: nil
            )
            created << category
          end
        end
        created
      end

      def build_category_map(existing_categories:, new_categories:)
        all_categories = existing_categories + new_categories
        map = {}
        all_categories.each do |category|
          key = "#{category.category_type}:#{category.name}"
          map[key] = category
        end
        map
      end

      def create_category_import_records(import:, new_categories:)
        return if new_categories.empty?

        # Ensure all categories have IDs before creating import records
        # If any category doesn't have an ID, skip creating import records for it
        categories_with_ids = new_categories.select(&:id)
        return if categories_with_ids.empty?

        import_records_to_create = categories_with_ids.map do |category|
          Imports::ImportRecord.new(
            import: import,
            record_type: category.class.name,
            record_id: category.id,
            row_number: 0, # Categories created during preparation are not tied to a specific row
            status: "success"
          )
        end

        # Bulk create import records for categories
        Imports::ImportRecord.import(
          import_records_to_create,
          validate: false
        )
      rescue StandardError => e
        Rails.logger.error("Failed to create category import records: #{e.message}\n#{e.backtrace.join("\n")}")
        # Continue - this is not critical
      end
    end
  end
end
