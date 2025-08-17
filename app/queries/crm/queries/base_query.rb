# frozen_string_literal: true

module Crm
  module Queries
    class BaseQuery < BaseQuery
      def initialize(relation: Crm::Ticket.all, params: {})
        super(relation:, params:)
      end
    end
  end
end
