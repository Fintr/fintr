# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class ShowAccounts < Dry::Operation
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

        include FailureHandler

        def call(params)
          params              = step validate(params:)
          accounts            = step get_accounts(params:)
          serialized_accounts = step serialize(accounts:)

          { accounts: serialized_accounts }
        end

        private

        def get_accounts(params:)
          query_result = Transactions::Queries::Accounts::DashboardAccounts
                           .call(params: params.merge(space_id: params[:space_id]))

          query_result
        end

        def serialize(accounts:)
          serialized_accounts =  Transactions::Serializers::Accounts::DashboardAccountSerializer
                                  .render_as_hash(accounts)
          Success(serialized_accounts)
        rescue StandardError => e
          Failure(error: e, message: "Serialization failed")
        end
      end
    end
  end
end
