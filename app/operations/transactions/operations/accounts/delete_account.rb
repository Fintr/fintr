# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class DeleteAccount < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:id).value(:string)
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
          account             = step find_account(params:)
          account             = step delete_account(account:)

          account
        end

        private

        def find_account(params:)
          account = Transactions::Account.find_by(id: params[:id], space_id: params[:space_id])
          return Failure(account: "not found") unless account

          Success(account)
        end

        def delete_account(account:)
          account.discard!
          Success(account)
        end
      end
    end
  end
end
