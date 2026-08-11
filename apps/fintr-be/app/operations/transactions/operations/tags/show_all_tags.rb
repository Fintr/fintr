# frozen_string_literal: true

module Transactions
  module Operations
    module Tags
      class ShowAllTags < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params = step validate(params:)
          step fetch_tags(params:)
        end

        private

        def fetch_tags(params:)
          tags = Transactions::Tag.where(space_id: params[:space_id]).order(:name)
          Success(tags)
        end
      end
    end
  end
end
