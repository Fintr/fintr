# frozen_string_literal: true

module Transactions
  module Operations
    module Tags
      class AssignPresetStyleImage < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).value(:string)
            required(:space_id).value(:string)
            required(:preset_key).filled(:string)
            optional(:user_id).maybe(:string)
          end
        end

        def call(params)
          params = step validate(params:)
          _     = step verify_pro_access(params:)
          tag   = step find_tag(params:)
          tag   = step assign_preset(tag:, preset_key: params[:preset_key])

          tag
        end

        private

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def verify_pro_access(params:)
          Finance::ProGate.require!(
            user_id: params[:user_id],
            space_id: params[:space_id],
          )
        end

        def find_tag(params:)
          tag = Transactions::Tag.find_by(id: params[:id], space_id: params[:space_id])
          return Failure(tag: "Not found") unless tag

          Success(tag)
        end

        def assign_preset(tag:, preset_key:)
          unless Transactions::TagStylePresets.valid?(preset_key)
            return Failure(preset_key: ["is not a valid sample style"])
          end

          tag.style_image.purge if tag.style_image.attached?
          tag.update!(style_preset_key: preset_key)

          Success(tag.reload)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(tag: [e.message])
        end
      end
    end
  end
end
