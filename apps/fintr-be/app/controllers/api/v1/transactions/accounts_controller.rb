# frozen_string_literal: true

module Api
  module V1
    module Transactions
      class AccountsController < ApiController
        def index
          operation = ::Transactions::Operations::Accounts::ShowAccounts.new.call(with_current_params)

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          account_category_options = ::Transactions::Account.account_category_options

          render_success(data: operation.value!.merge(account_category_options:))
        end

        def create
          operation = ::Transactions::Operations::Accounts::CreateAccount.new.call(with_current_params(create_params))

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_created(record: operation.value!)
        end

        def update
          operation = ::Transactions::Operations::Accounts::UpdateAccount.new.call(with_current_params(update_params))

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end

        def destroy
          operation = ::Transactions::Operations::Accounts::DeleteAccount.new.call(with_current_params(delete_params))

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(data: operation.value!)
        end

        def adjust_balance
          operation = ::Transactions::Operations::Accounts::AdjustAccountBalance.new.call(with_current_params(adjust_balance_params))
          return render_unprocessable_content(details: operation.failure) unless operation.success?
          render_success(data: operation.value!)
        end

        def activities
          query = ::Transactions::Queries::FilteredAccountActivities.call(params: activity_params)

          return render_unprocessable_content(details: query.failure) unless query.success?

          render_paginated(
            query.value!,
            serializer: ::Transactions::Serializers::FilteredAccountActivitySerializer,
            key: :activities
          )
        end

        private

        def create_params
          params.permit(:name, :balance, :account_category, :balance_currency)
        end

        def adjust_balance_params
          params.permit(:id, :new_balance, :adjustment_date)
        end

        def update_params
          params.permit(:id, :name, :balance_currency)
        end

        def delete_params
          params.permit(:id)
        end

        def activity_params
          with_current_params(
            params.permit(
              :id,
              :start_date,
              :end_date,
              :category_name,
              :category_id,
              :subcategory_id,
              :min_amount,
              :max_amount,
              :search_query,
              :page,
              :per_page
            ).to_h.merge(account_id: params[:id])
          )
        end
      end
    end
  end
end
