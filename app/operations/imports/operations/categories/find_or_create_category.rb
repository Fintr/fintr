# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Imports
  module Operations
    module Categories
      class FindOrCreateCategory < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).filled(:string)
            required(:row_number).filled(:integer)
            required(:import).filled(type?: Imports::Import)
            required(:row_data).hash do
              required(:category_name).filled(:string)
              required(:category_type).filled(:string)
            end
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler
        include Dry::Operation::Extensions::ActiveRecord


        def call(params)
          _             = step validate(params:)
          category_data = step find_or_create_category(
                                  space_id: params[:space_id],
                                  name: params[:row_data][:category_name],
                                  category_type: params[:row_data][:category_type]
                                )
          # Track category creation if it was newly created
          _             = step create_category_import_record(
                            row_number: params[:row_number],
                            import: params[:import],
                            category: category_data[:category]
                          ) if category_data[:was_new]

          category_data
        end

        private

        def find_or_create_category(space_id:, name:, category_type:)
          # Handle race conditions when multiple rows try to create the same category
          # Strategy: Try to find first, if not found, try to create with retry
          category = Transactions::Category.find_by(space_id:, name:, category_type:)

          if category
            was_new = false
          else
            # Try to create, but handle race condition if another process created it
            was_new = create_category_with_race_condition_handling(space_id:, name:, category_type:)
            category = Transactions::Category.find_by!(space_id:, name:, category_type:)
          end

          Success({ category: category, was_new: was_new })
        rescue ActiveRecord::RecordNotFound => e
          Failure(error: "Category not found after creation attempt: #{e.message}")
        rescue StandardError => e
          Failure(error: e.message, errors: [e.message])
        end

        def create_category_with_race_condition_handling(space_id:, name:, category_type:)
          Transactions::Category.create!(
            space_id: space_id,
            name: name,
            category_type: category_type
          )
          true
        rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid
          # Race condition: category was created by another process between find and create
          false
        end

        def create_category_import_record(row_number:, import:, category:)
          # Use find_or_create_by! to handle race conditions
          # If multiple rows try to create the same category import record,
          # only one will succeed and others will get the existing record
          import.import_records.find_or_create_by!(
            record_type: category.class.name,
            record_id: category.id,
            import: import
          ) do |record|
            record.row_number = row_number
            record.status = "success"
          end

          Success(true)
        rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid
          # Race condition: record was created by another process
          # This is fine, we can just return success
          Success(true)
        end
      end
    end
  end
end
