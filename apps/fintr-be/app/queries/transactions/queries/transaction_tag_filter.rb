# frozen_string_literal: true

module Transactions
  module Queries
    module TransactionTagFilter
      TAG_EXISTS_SQL = <<~SQL.squish
        EXISTS (
          SELECT 1
          FROM transaction_taggings tag_filter_tg
          WHERE tag_filter_tg.transaction_id = transactions.id
            AND tag_filter_tg.tag_id = ?
        )
      SQL

      private

      def transaction_tag_filter_blank?(params)
        params[:tag_ids].blank?
      end

      def apply_transaction_tag_filters(relation, params)
        return Success(relation) if transaction_tag_filter_blank?(params)

        tag_ids = params[:tag_ids].uniq
        clauses = tag_ids.map { TAG_EXISTS_SQL }
        Success(relation.where(clauses.join(" OR "), *tag_ids))
      end
    end
  end
end
