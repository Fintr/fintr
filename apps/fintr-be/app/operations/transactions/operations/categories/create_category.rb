# frozen_string_literal: true

module Transactions
  module Operations
    module Categories
      class CreateCategory < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).filled(:string)
            required(:name).filled(:string)
            required(:category_type).filled(:string)
            optional(:parent_id).maybe(:string)
          end

          rule(:category_type) do
            unless %w[ expense income ].include?(value)
              key.failure("must be either 'expense' or 'income'")
            end
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)

          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call(params)
          _            = step validate(params:)
          category     = step create_category(params:)

          category
        end

        def create_category(params:)
          attrs = params.slice(:space_id, :name, :category_type, :parent_id)
          category = Transactions::Category.find_or_initialize_by(attrs)
          category.save!
          Success(category)
        rescue ActiveRecord::ActiveRecordError => e
          Failure(**category.errors.to_hash, error: e)
        end
      end
    end
  end
end
