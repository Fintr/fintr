module Transactions
  module Queries
    module Accounts
      class DashboardAccounts < BaseQuery
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
          end
        end

        def validate
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        def call
          params    = step validate
          relation  = step by_space(@relation, params)
          relation  = step order(relation)

          relation
        end

        private

        def order(relation)
          relation = relation.order(name: :asc)
          Success(relation)
        end
      end
    end
  end
end
