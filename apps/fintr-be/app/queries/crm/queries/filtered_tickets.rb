# frozen_string_literal: true

module Crm
  module Queries
    class FilteredTickets < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          optional(:status).maybe(:string)
          optional(:ticket_type).maybe(:string)
          optional(:priority).maybe(:string)
          optional(:search_query).maybe(:string)
          optional(:page).maybe(:integer)
          optional(:per_page).maybe(:integer)
        end
      end

      def validate
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call
        validated_params = step validate
        filtered_relation = step apply_filters(@relation, validated_params)
        paginated_relation = step paginate(filtered_relation, params)

        paginated_relation
      end

      private

      def apply_filters(relation, params)
        relation = relation.recent # Default ordering
        relation = step filter_by_status(relation, params[:status])
        relation = step filter_by_type(relation, params[:ticket_type])
        relation = step filter_by_priority(relation, params[:priority])
        relation = step filter_by_search(relation, params[:search_query])

        Success(relation)
      end

      def filter_by_status(relation, status)
        return Success(relation) unless status.present?
        Success(relation.by_status(status))
      end

      def filter_by_type(relation, ticket_type)
        return Success(relation) unless ticket_type.present?
        Success(relation.by_type(ticket_type))
      end

      def filter_by_priority(relation, priority)
        return Success(relation) unless priority.present?
        Success(relation.by_priority(priority))
      end

      def filter_by_search(relation, search_query)
        return Success(relation) unless search_query.present?

        relation = relation.where(
          "title ILIKE :query OR description ILIKE :query",
          query: "%#{search_query}%"
        )
        Success(relation)
      end
    end
  end
end
