# frozen_string_literal: true

module Transactions
  module Queries
    module CombinedTagFilter
      TAG_EXISTS_SQL = <<~SQL.squish
        EXISTS (
          SELECT 1
          FROM transaction_taggings tag_filter_tg
          INNER JOIN transactions tag_filter_tx ON tag_filter_tx.id = tag_filter_tg.transaction_id
          WHERE tag_filter_tx.id = combined_transactions.transactable_id
            AND combined_transactions.transactable_type IN (
              'Transactions::Income',
              'Transactions::Expense'
            )
            AND tag_filter_tg.tag_id = ?
        )
      SQL

      private

      def combined_tag_filter_blank?(params)
        params[:tag_ids].blank?
      end

      def apply_combined_tag_filters(relation, params)
        return Success(relation) if combined_tag_filter_blank?(params)

        tag_ids = params[:tag_ids].uniq
        clauses = tag_ids.map { TAG_EXISTS_SQL }
        Success(relation.where(clauses.join(" OR "), *tag_ids))
      end
    end
  end
end
