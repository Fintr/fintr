# frozen_string_literal: true

module Transactions
  module Queries
    class LastRecord < BaseQuery
      class Contract < Dry::Validation::Contract
        ACCEPTED_RECORDS = [
          Transactions::Transaction,
          Transactions::Expense,
          Transactions::Income,
          Transactions::Transfer
        ].freeze

        params do
          required(:record)
          required(:date_end).value(:date)
        end

        rule(:record) do
          key.failure("must be an instance of #{ACCEPTED_RECORDS.map(&:name).map(&:demodulize).join(", ")}") unless ACCEPTED_RECORDS.include?(value.class)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call
        params      = step validate(params: @params)
        relation    = step where(relation: @relation, params:)
        relation    = step order(relation:)
        relation.first
      end

      def where(relation:, params:)
        parent_id = params[:record].parent_id || params[:record].id
        relation = relation.where(
          '
            (parent_id = :parent_id OR id = :parent_id)
            and date <= :date_end
          ',
          parent_id:,
          date_end: params[:date_end].end_of_day
        )
        Success(relation)
      end

      def order(relation:)
        Success(relation.order(date: :desc))
      end
    end
  end
end
