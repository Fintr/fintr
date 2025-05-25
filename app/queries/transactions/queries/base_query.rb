# frozen_string_literal: true

module Transactions
  module Queries
    class BaseQuery < BaseQuery
      def initialize(relation: Transactions::Transaction.all, params: {})
        super(relation:, params:)
      end

      attr_reader :for_union, :space

      private

      def by_space(relation, params)
        Success(relation.where(space: @space))
      rescue StandardError => e
        Failure(space_code: "Not found")
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
        Failure(date: "Invalid date")
      end

      def by_amount(relation, params)
        return Success(relation) unless params[:min_amount] || params[:max_amount]

        min_amount = params[:min_amount]&.to_d&.*(100) || 0
        max_amount = params[:max_amount] ? params[:max_amount]&.to_d&.*(100) : Float::INFINITY
        relation = relation.where(amount_cents: min_amount..max_amount)
        Success(relation)
      end

      def by_balance_state(relation, params)
        return Success(relation) unless params[:balance_state]

        relation = relation.where(balance_state: params[:balance_state])
        Success(relation)
      end
    end
  end
end
