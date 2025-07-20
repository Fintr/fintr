# frozen_string_literal: true

module Transactions
  module Queries
    module Accounts
      class BaseQuery < Transactions::Queries::BaseQuery
        def initialize(relation: Transactions::Account.kept, params: {})
          super(relation:, params:)
        end

        private

        def by_space(relation, params)
          Success(relation.where(space_id: params[:space_id]))
        end
      end
    end
  end
end
