# frozen_string_literal: true

module Transactions
  module Operations
    module Accounts
      class UpdateAccount < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:space_id).value(:string)
            required(:id).value(:string)
            required(:name).value(:string)
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
          account             = step update_account(account:, params:)

          account
        end

        private

        def find_account(params:)
          account = Transactions::Account.find(params[:id])
          Success(account)
        rescue ActiveRecord::RecordNotFound
          Failure(account: "not found")
        end

        def update_account(account:, params:)
          account.update!(name: params[:name])
          Success(account)
        rescue ActiveRecord::RecordInvalid
          Failure(**account.errors.to_hash)
        end
      end
    end
  end
end
