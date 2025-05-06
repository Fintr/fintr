# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class AccountsController < ApiController
        def create
          operation = ::Transactions::Operations::Accounts::CreateAccount.new.call(params: with_current_params(create_params))

          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          render_created(record: operation.value!)
        end

        private

        def create_params
          params.permit(:name, :balance, :account_category)
        end
      end
    end
  end
end
