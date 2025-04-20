module Transactions
  module Operations
    class CreateTransaction < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:amount).value(:decimal)
          required(:date).value(:date)
          optional(:description).value(:string)
          required(:category_name).value(:string)
          required(:account_name).value(:string)
        end
      end

      def validate(params)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        _ = step validate(params)
      end
    end
  end
end
