# frozen_string_literal: true

module Transactions
  module Queries
    class LastTransaction < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction_id).value(:string)
          required(:date_end).value(:date)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success()
      end

      def call(params:)
        _           = step validate(params:)
        relation    = step where(relation: @relation, params: params)
        relation    = step order(relation:)
        relation.first
      end

      def where(relation:, params:)
        relation = relation.where(
          '
            (parent_id = :transaction_id OR id = :transaction_id)
            and date <= :date_end
          ',
          transaction_id: params[:transaction_id],
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
