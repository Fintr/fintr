# frozen_string_literal: true

module Admin
  module Queries
    class UsersQuery < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          optional(:search_query).maybe(:string)
          optional(:page).maybe(:integer)
          optional(:per_page).maybe(:integer)
        end
      end

      def validate
        contract = Contract.new.call(search_query: params[:search_query], page: params[:page])
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def initialize(relation: Auth::User.all, params: {})
        super(relation:, params:)
      end

      def call
        params    = step validate
        relation  = step by_query(@relation, params)
        relation  = step paginate(relation, params)
        relation
      end

      private

      def by_query(relation, params)
        relation = relation.where(
          "users.email ILIKE :search_query or users.full_name ILIKE :search_query",
          search_query: "%#{params[:search_query]}%"
        )
        Success(relation)
      end
    end
  end
end
