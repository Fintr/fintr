# frozen_string_literal: true

module Transactions
  module Operations
    module Tags
      class CreateTag < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).filled(:string)
            required(:name).filled(:string)
            optional(:color).maybe(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          _   = step validate(params:)
          tag = step create_tag(params:)

          tag
        end

        private

        def create_tag(params:)
          color = resolve_color(params:)
          if color.respond_to?(:failure?) && color.failure?
            return color
          end

          tag = Transactions::Tag.new(
            space_id: params[:space_id],
            name: params[:name],
            color: color,
          )
          tag.save!
          Success(tag)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(**tag.errors.to_hash, error: e)
        end

        def resolve_color(params:)
          return nil if params[:color].blank?

          normalized = Transactions::CategoryAppearance.normalize_color(params[:color])
          return Failure(color: ["must be a valid hex color"]) unless normalized

          normalized
        end
      end
    end
  end
end
