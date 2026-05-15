# frozen_string_literal: true

module Transactions
  module Queries
    # Filters +combined_transactions+ rows by resolving the space account by name, then matching
    # the underlying +transactions.account_id+ (income/expense) or +transfers+ from/to ids. This
    # avoids relying on view +to_account_name+ / +from_account_name+ CASE columns alone.
    module CombinedAccountJoinFilter
      private

      def filter_combined_relation_by_account(relation, params)
        return Success(relation) if ["all", "", nil].include?(params[:account_name])

        name    = params[:account_name].to_s
        account = Transactions::Account.kept.find_by(
          name: name,
          space_id: @space.id
        )

        if account
          relation = relation
            .joins(<<~SQL.squish)
              LEFT OUTER JOIN transactions acct_tx_filter
                ON acct_tx_filter.id = combined_transactions.transactable_id
               AND combined_transactions.transactable_type IN (
                 'Transactions::Income',
                 'Transactions::Expense'
               )
              LEFT OUTER JOIN transfers acct_tr_filter
                ON acct_tr_filter.id = combined_transactions.transactable_id
               AND combined_transactions.transactable_type = 'Transactions::Transfer'
            SQL
            .where(
              "acct_tx_filter.account_id = :account_id OR " \
              "acct_tr_filter.from_account_id = :account_id OR " \
              "acct_tr_filter.to_account_id = :account_id",
              account_id: account.id
            )
          Success(relation)
        else
          Success(legacy_combined_name_filter(relation, name))
        end
      end

      def legacy_combined_name_filter(relation, name)
        relation
          .where(to_account_name: name)
          .or(relation.where(from_account_name: name))
      end
    end
  end
end
