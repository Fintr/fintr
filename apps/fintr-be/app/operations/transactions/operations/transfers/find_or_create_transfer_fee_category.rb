# frozen_string_literal: true

module Transactions
  module Operations
    module Transfers
      class FindOrCreateTransferFeeCategory < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
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

        def find_or_create_category(params:)
          category = Transactions::Category.find_or_create_by!(
            name: "Transfer Fee",
            space_id: params[:space_id],
            category_type: "expense"
          )
          Success(category)
        rescue ActiveRecord::RecordInvalid => e
          Failure(category: "could not create Transfer Fee category", error: e, expected: true)
        end
      end
    end
  end
end
