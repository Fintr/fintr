# frozen_string_literal: true

module Transactions
  module Operations
    module Tags
      class UpdateTag < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).value(:string)
            required(:space_id).value(:string)
            required(:name).value(:string)
            optional(:color).maybe(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          tag    = step find_tag(params:)
          tag    = step update_tag(params:, tag:)

          tag
        end

        private

        def find_tag(params:)
          tag = Transactions::Tag.find_by(id: params[:id], space_id: params[:space_id])
          return Failure(tag: "Not found") unless tag

          Success(tag)
        end

        def update_tag(params:, tag:)
          color = Transactions::CategoryAppearance.normalize_color(params[:color]) || tag.color
          tag.update!(name: params[:name], color: color)
          Success(tag)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(**tag.errors.to_hash, error: e)
        end
      end
    end
  end
end
