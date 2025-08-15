# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class AccountsController < ApiController
        def index
          operation = ::Transactions::Operations::Accounts::ShowAccounts.new.call(with_current_params)

          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          account_category_options = ::Transactions::Account.account_category_options

          render_success(data: operation.value!.merge(account_category_options:))
        end

        def create
          operation = ::Transactions::Operations::Accounts::CreateAccount.new.call(with_current_params(create_params))

          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          render_created(record: operation.value!)
        end

        def update
          operation = ::Transactions::Operations::Accounts::UpdateAccount.new.call(with_current_params(update_params))

          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end

        def destroy
          operation = ::Transactions::Operations::Accounts::DeleteAccount.new.call(with_current_params(delete_params))

          return render_unprocessable_entity(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end

        private

        def create_params
          params.permit(:name, :balance, :account_category)
        end

        def update_params
          params.permit(:id, :name)
        end

        def delete_params
          params.permit(:id)
        end
      end
    end
  end
end
