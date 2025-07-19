# frozen_string_literal: true

module Transactions
  module Queries
    module Categories
      class AllCategories < BaseQuery
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            optional(:category_type).maybe(:string)
          end

          rule(:category_type) do
            key.failure("must be either 'income' or 'expense'") if value.present? && %w[income expense].exclude?(value)
          end
        end

        def validate
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call
          params        = step validate
          relation      = step joins(@relation)
          relation      = step by_space(relation, params)
          relation      = step by_category_type(relation, params)
          relation      = step order(relation)
          relation
        end

        private

        def joins(relation)
          relation = relation.joins(:space)
          Success(relation)
        end

        def by_category_type(relation, params)
          return Success(relation) if params[:category_type].blank?

          relation = case params[:category_type]
          when "income"
              relation.income
          when "expense"
              relation.expense
          else
              relation
          end
          Success(relation)
        end

        def order(relation)
          relation = relation.order(name: :asc)
          Success(relation)
        end
      end
    end
  end
end
