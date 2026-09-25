# frozen_string_literal: true

module Imports
  module Operations
    module Merchants
      class ResolveMerchants < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).filled(:string)
            required(:import).filled(type?: Imports::Import)
            required(:names).array(:string)
          end
        end

        include FailureHandler

        def call(params)
          params = step validate(params:)
          names = step normalize_names(params:)
          step resolve_merchants(params:, names:)
        end

        private

        def validate(params:)
          result = Contract.new.call(**params)
          return Failure(result.errors.to_h) unless result.success?

          Success(result.to_h)
        end

        def normalize_names(params:)
          names = params[:names].filter_map { |name| name.to_s.strip.presence }.uniq
          Success(names)
        end

        def resolve_merchants(params:, names:)
          return Success({}) if names.empty?

          space_id = params[:space_id]
          existing = Entities::Entity.where(
            space_id: space_id,
            entity_type: "transaction",
            full_name: names
          ).index_by(&:full_name)

          resolved = existing.dup
          created = []
          (names - existing.keys).each do |name|
            entity, was_new = create_merchant(space_id:, name:)
            resolved[entity.full_name] = entity
            created << entity if was_new
          end
          track_created_merchants(
            import: params[:import],
            merchants: created
          )

          Success(resolved)
        rescue ActiveRecord::RecordNotFound => e
          Failure(merchant: "could not be created", error: e.message)
        end

        def create_merchant(space_id:, name:)
          entity = Entities::Entity.create!(
            space_id: space_id,
            entity_type: "transaction",
            full_name: name
          )
          [entity, true]
        rescue ActiveRecord::RecordNotUnique, ActiveRecord::RecordInvalid
          entity = Entities::Entity.find_by!(
            space_id: space_id,
            entity_type: "transaction",
            full_name: name
          )
          [entity, false]
        end

        def track_created_merchants(import:, merchants:)
          merchants.each do |merchant|
            import.import_records.find_or_create_by!(
              record_type: merchant.class.name,
              record_id: merchant.id
            ) do |record|
              record.row_number = 0
              record.status = "success"
              record.original_data = { "merchant" => merchant.full_name }
            end
          end
        rescue StandardError => e
          Rails.logger.error(
            "Failed to track imported merchants: #{e.message}\n#{e.backtrace.join("\n")}"
          )
        end
      end
    end
  end
end
