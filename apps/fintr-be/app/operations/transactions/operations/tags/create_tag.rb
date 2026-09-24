# frozen_string_literal: true

module Transactions
  module Operations
    module Tags
      class CreateTag < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).filled(:string)
            required(:name).filled(:string)
            optional(:id).maybe(:string)
            optional(:color).maybe(:string)
            optional(:style_preset_key).maybe(:string)
            optional(:user_id).maybe(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          _      = step verify_style_preset(params:)
          tag    = step create_tag(params:)

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
            id: params[:id],
            style_preset_key: params[:style_preset_key],
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

        def verify_style_preset(params:)
          preset_key = params[:style_preset_key]
          return Success(true) if preset_key.blank?

          unless Transactions::TagStylePresets.valid?(preset_key)
            return Failure(style_preset_key: ["is not a valid sample style"])
          end

          Finance::ProGate.require!(
            user_id: params[:user_id],
            space_id: params[:space_id],
          )
        end
      end
    end
  end
end
