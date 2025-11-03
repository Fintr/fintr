# frozen_string_literal: true

module Transactions
  module Operations
    module Loans
      class FindOrCreateInterestCategory < Dry::Operation
        class Contract < Dry::Validation::Contract
          VALID_LOAN_TYPES = %w[borrowed lent].freeze
          params do
            required(:space_id).value(:string)
            required(:loan_type).value(:string, included_in?: VALID_LOAN_TYPES)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(error: contract.errors.to_h) if contract.failure?

          Success(contract.to_h)
        end

        def call(params)
          params    = step validate(params:)
          category  = step find_or_create_category(params:)
          category
        end

        private

        def find_or_create_category(params:)
          category_name = params[:loan_type] == "borrowed" ? "Interest Expense" : "Interest Income"
          category_type = params[:loan_type] == "borrowed" ? "expense" : "income"

          category = Transactions::Category.find_or_create_by!(
            name: category_name,
            space_id: params[:space_id],
            category_type: category_type
          )
          Success(category)
        rescue ActiveRecord::RecordInvalid => e
          Failure(category: "could not create #{category_name} category", error: e, expected: true)
        end
      end
    end
  end
end

