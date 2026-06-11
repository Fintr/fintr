# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      # Discards the account only. Per-transaction balance reverts use
      # DeleteThisTransaction (`ResolveSignedBalanceEffect` + Money.from_amount). Bulk space
      # teardown uses Spaces::Operations::ResetData (destroy_all), not this class.
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
          save_result = SaveAccount.new.call(
            account:,
            cause: "account_discard",
            operation: self.class.name,
            action: "discard"
          )
          return save_result if save_result.failure?

          Success(account)
        end
      end
    end
  end
end
