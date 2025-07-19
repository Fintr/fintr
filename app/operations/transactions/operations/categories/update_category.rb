# frozen_string_literal: true

module Transactions
  module Operations
    module Categories
      class UpdateCategory < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:id).value(:string)
            required(:space_id).value(:string)
            required(:name).value(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)

          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          params    = step validate(params:)
          category  = step find_category(params:)
          category  = step update_category(params:, category:)

          category
        end

        private

        def find_category(params:)
          category = Transactions::Category.find_by(id: params[:id], space_id: params[:space_id])

          return Failure(category: "Not found") unless category

          Success(category)
        end

        def update_category(params:, category:)
          category.update(name: params[:name])

          Success(category)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(**category.errors.to_hash, error: e)
        end
      end
    end
  end
end
