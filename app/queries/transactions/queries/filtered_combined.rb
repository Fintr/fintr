# frozen_string_literal: true

module Transactions
  module Queries
    class FilteredCombined < BaseQuery
      # Contract defined in app/queries/transactions/queries/filtered_transactions.rb

      def initialize(relation: Transactions::Combined.all, params: {})
        super(relation:, params:)
      end

      def validate
        contract = Transactions::Queries::FilteredTransactions::Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        @space = Spaces::Space.find_by(code: params[:space_code])
        return Failure(space_code: "Not found") if @space.blank?

        Success(contract.to_h)
      end

      def call
        params        = step validate
        relation      = step joins(@relation)
        relation      = step by_space(relation, params)
        relation      = step by_date(relation, params)
        relation      = step by_balance_state(relation, params)
        relation      = step by_amount(relation, params)
        relation      = step by_category(relation, params)
        relation      = step order(relation)
        step paginate(relation, params)
      end

      private

      def joins(relation)
        relation = relation.joins(
          "INNER JOIN spaces ON spaces.id = combined_transactions.space_id"
        )
        Success(relation)
      rescue StandardError
        Failure(:join_error)
      end

      def by_category(relation, params)
        return Success(relation) if ["all", ""].include?(params[:category_name])

        relation = relation.where(transactions_categories: { name: params[:category_name] })
        Success(relation)
      end

      def order(relation)
        relation = relation.order(
          date: :desc,
          transactable_type: :desc,
          amount_cents: :desc
        )
        Success(relation)
      end
    end
  end
end
