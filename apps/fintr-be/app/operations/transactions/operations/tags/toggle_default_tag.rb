# frozen_string_literal: true

module Transactions
  module Operations
    module Tags
      class ToggleDefaultTag < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).value(:string)
            required(:space_id).value(:string)
          end
        end

        def call(params)
          params = step validate(params:)
          tag    = step find_tag(params:)
          tag    = step toggle_default(tag:)

          tag
        end

        private

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def find_tag(params:)
          tag = Transactions::Tag.find_by(id: params[:id], space_id: params[:space_id])
          return Failure(tag: "Not found") unless tag

          Success(tag)
        end

        def toggle_default(tag:)
          Transactions::Tag.transaction do
            if tag.is_default?
              tag.update!(is_default: false)
            else
              Transactions::Tag
                .where(space_id: tag.space_id, is_default: true)
                .update_all(is_default: false)
              tag.update!(is_default: true)
            end
          end

          Success(tag.reload)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(**tag.errors.to_hash, error: e)
        end
      end
    end
  end
end
