# frozen_string_literal: true

require "dry/operation/extensions/active_record"

module Transactions
  module Operations
    module Tags
      class DeleteTag < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).value(:string)
            required(:space_id).value(:string)
          end
        end

        include Dry::Operation::Extensions::ActiveRecord

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          tag    = step find_tag(params:)

          transaction do
            _   = step remove_tag_assignments(tag:)
            tag = step delete_tag(tag:)
            tag
          end
        end

        private

        def find_tag(params:)
          tag = Transactions::Tag.find_by(id: params[:id], space_id: params[:space_id])
          return Failure(tag: "Not found") unless tag

          Success(tag)
        end

        def remove_tag_assignments(tag:)
          tag.transaction_taggings.delete_all
          Success(tag)
        end

        def delete_tag(tag:)
          tag.destroy
          Success(tag)
        end
      end
    end
  end
end
