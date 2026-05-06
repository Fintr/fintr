# frozen_string_literal: true

module Transactions
  module Queries
    module Transfers
      class FilteredTransfers < BaseQuery
        # Contract defined in app/queries/transactions/queries/filtered_transactions.rb

        def validate
          contract = Transactions::Queries::FilteredTransactions::Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          @space = Spaces::Space.find_by(code: params[:space_code])
          return Failure(space_code: "not found") if @space.blank?

          Success(contract.to_h)
        end

        def call
          params    = step validate
          relation  = step joins(@relation)
          relation  = step by_space(relation, params)
          relation  = step by_date(relation, params)
          relation  = step by_amount(relation, params)
          relation  = step by_search_query(relation, params)
          relation  = step select(relation)
          relation  = step order(relation)
          relation  = step paginate(relation, params)
          relation
        end

        def joins(relation)
          relation = relation.joins(
            "INNER JOIN spaces ON spaces.id = transfers.space_id",
            "LEFT OUTER JOIN accounts as to_accounts ON to_accounts.id = transfers.to_account_id",
            "LEFT OUTER JOIN accounts as from_accounts ON from_accounts.id = transfers.from_account_id"
          )
          Success(relation)
        rescue StandardError
          Failure(:join_error)
        end

        def select(relation)
          relation = relation.select(
            "id",
            "date",
            "amount_cents",
            "amount_currency",
            "NULL as balance_cents",
            "NULL as balance_currency",
            "description",
            "'Transactions::Transfer' as transaction_type",
            "to_accounts.name as to_account_name",
            "from_accounts.name as from_account_name",
            "NULL as category_name",
          )
          Success(relation)
        rescue StandardError
          Failure(:select_error)
        end

        def order(relation)
          relation =  relation.order(
                        date: :desc,
                        amount_currency: :asc,
                        amount_cents: :desc
                      )
          Success(relation)
        rescue StandardError
          Failure(:order_error)
        end
      end
    end
  end
end
