# frozen_string_literal: true

module Transactions
  module Queries
    class FilteredTransactions < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:page).value(:integer)
          required(:space_code).value(:string)
          required(:category_name).value(:string)
          required(:start_date).value(:date)
          required(:end_date).value(:date)
        end
      end

      attr_reader :space

      def validate
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        @space = Spaces::Space.find_by(code: params[:space_code])
        return Failure({ space_code: "Not found" }) if @space.blank?

        Success()
      end

      def call
        _        = step validate
        relation = step joins(@relation)
        relation = step by_space(relation, params)
        relation = step by_date(relation, params)
        relation = step by_category(relation, params)
        relation = step select(relation)
        relation = step order(relation)
        step paginate(relation, params)
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
          "type",
          "accounts.name as account_name",
          "transactions_categories.name as category_name",
        )
        Success(relation)
      rescue StandardError
        Failure(:select_error)
      end

      def by_space(relation, params)
        Success(relation.where(spaces: { code: params[:space_code] }))
      rescue StandardError => e
        Failure(:by_space_error)
      end

      def by_date(relation, params)
        return Success(relation) if params[:start_date].blank? && params[:end_date].blank?

        relation = if params[:start_date].present? && params[:end_date].blank?
          relation.where(date: params[:start_date]..)
        elsif params[:start_date].blank? && params[:end_date].present?
          relation.where(date: ..params[:end_date])
        else
          relation.where(date: params[:start_date]..params[:end_date])
        end
        Success(relation)
      rescue StandardError
        Failure(:by_date_error)
      end

      def by_category(relation, params)
        return Success(relation) if [ "all", "" ].include?(params[:category_name])

        relation = relation.where(transactions_categories: { name: params[:category_name] })
        Success(relation)
      end

      def order(relation)
        relation =  relation.order(
                      date: :asc,
                      type: :desc,
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
