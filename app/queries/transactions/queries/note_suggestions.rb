# frozen_string_literal: true

module Transactions
  module Queries
    class NoteSuggestions < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
          optional(:category_name).value(:string)
          optional(:transaction_type).value(:string)
          optional(:search).value(:string)
          optional(:limit).value(:integer)
        end
      end

      def initialize(relation: Transactions::Transaction.all, params: {})
        super(relation:, params:)
      end

      def call
        relation = step filter_by_space(relation: @relation, params:)
        relation = step filter_by_category(relation:, params:)
        relation = step filter_by_transaction_type(relation:, params:)
        relation = step filter_by_search(relation:, params:)
        relation = step select_distinct_notes(relation:, params:)
        relation
      end

      private

      def filter_by_space(relation:, params:)
        relation = relation.where(space_id: params[:space_id])
        Success(relation)
      end

      def filter_by_category(relation:, params:)
        return Success(relation) if params[:category_name].blank?

        category = Transactions::Category.find_by(
          space_id: params[:space_id],
          name: params[:category_name]
        )
        return Success(relation.none) unless category

        relation = relation.where(category_id: category.id)
        Success(relation)
      end

      def filter_by_transaction_type(relation:, params:)
        return Success(relation) if params[:transaction_type].blank?

        # Use STI type column: Transactions::Expense or Transactions::Income
        type_class = case params[:transaction_type].to_s
        when "expense" then "Transactions::Expense"
        when "income" then "Transactions::Income"
        else return Success(relation)
        end

        relation = relation.where(type: type_class)
        Success(relation)
      end

      def filter_by_search(relation:, params:)
        return Success(relation) if params[:search].blank?

        search_term = "%#{params[:search].downcase}%"
        relation = relation.where("LOWER(description) LIKE ?", search_term)
        Success(relation)
      end

      def select_distinct_notes(relation:, params:)
        limit = (params[:limit] || 10).to_i

        # Get distinct non-empty descriptions, ordered by most recent
        notes = relation
          .where.not(description: [nil, ""])
          .order(date: :desc, created_at: :desc)
          .pluck(:description)
          .uniq
          .first(limit)

        Success(notes)
      end
    end
  end
end
