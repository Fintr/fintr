# frozen_string_literal: true

module Spaces
  module Queries
    class DashboardData < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
        end
      end

      def validate(params)
        result = Contract.new.call(**params)

        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def call
        _        = step validate(params)
        relation = step includes(@relation)
        relation = step by_space_code(relation, params)
        relation.first
      end

      def by_space_code(relation, params)
        Success(
          relation.where(code: params[:space_code])
        )
      end

      def includes(relation)
        relation = relation.includes(
          :categories,
          :accounts
        )
        Success(relation)
      end
    end
  end
end
