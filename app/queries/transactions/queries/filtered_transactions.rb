# frozen_string_literal: true

module Transactions
  module Queries
    class FilteredTransactions < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
          required(:category_name).value(:string)
          required(:start_date).value(:date)
          required(:end_date).value(:date)
          optional(:page).value(:integer)
          optional(:min_amount).maybe(:integer, gteq?: 0)
          optional(:max_amount).maybe(:integer)
          optional(:per_page).maybe(:integer)
        end

        rule(:min_amount, :max_amount) do
          if values[:min_amount].is_a?(Integer) && values[:max_amount].is_a?(Integer)
            key.failure("should be less than max_amount") if values[:min_amount] > values[:max_amount]
          end
        end
      end

      attr_reader :space

      def validate
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        @space = Spaces::Space.find_by(code: params[:space_code])
        return Failure({ space_code: "Not found" }) if @space.blank?

        Success(contract.to_h)
      end

      def call
        params   = step validate
        relation = step joins(@relation)
        relation = step by_space(relation, params)
        relation = step by_date(relation, params)
        relation = step by_category(relation, params)
        relation = step by_amount(relation, params)
        relation = step select(relation)
        relation = step order(relation)
        relation = step paginate(relation, params)
        relation
      end

      def joins(relation)
        relation = relation.joins(
          "INNER JOIN accounts ON accounts.id = transactions.account_id",
          "INNER JOIN spaces ON spaces.id = transactions.space_id",
          "INNER JOIN transactions_categories ON transactions_categories.id = transactions.category_id"
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
          "transactions.balance_cents as balance_cents",
          "transactions.balance_currency as balance_currency",
          "description",
          "transactions.type as transaction_type",
          "NULL as from_account_name",
          "accounts.name as to_account_name",
          "transactions_categories.name as category_name",
        )
        Success(relation)
      rescue StandardError
        Failure(:select_error)
      end


      def by_category(relation, params)
        return Success(relation) if ["all", ""].include?(params[:category_name])

        relation = relation.where(transactions_categories: { name: params[:category_name] })
        Success(relation)
      end

      def order(relation)
        relation =  relation.order(
                      date: :desc,
                      transaction_type: :desc,
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
