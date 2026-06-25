# frozen_string_literal: true

module Transactions
  module Queries
    # Filters +combined_transactions+ rows by resolving the space account by name, then matching
    # the underlying +transactions.account_id+ (income/expense) or +transfers+ from/to ids. This
    # avoids relying on view +to_account_name+ / +from_account_name+ CASE columns alone.
    module CombinedAccountJoinFilter
      private

      def filter_combined_relation_by_account(relation, params)
        account_names = normalize_account_filter_names(params)
        return Success(relation) if account_names.empty? && params[:account_id].blank?

        accounts = resolve_filter_accounts(params, account_names)
        if accounts.any?
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
              LEFT OUTER JOIN loans acct_loan_filter
                ON acct_loan_filter.id = combined_transactions.transactable_id
               AND combined_transactions.transactable_type = 'Transactions::Loan'
              LEFT OUTER JOIN loan_payments acct_lp_filter
                ON acct_lp_filter.id = combined_transactions.transactable_id
               AND combined_transactions.transactable_type = 'Transactions::LoanPayment'
            SQL

          clauses = accounts.flat_map do |account|
            [
              "acct_tx_filter.account_id = ?",
              "acct_tr_filter.from_account_id = ?",
              "acct_tr_filter.to_account_id = ?",
              "acct_loan_filter.account_id = ?",
              "acct_lp_filter.account_id = ?",
            ].map { |clause| [clause, account.id] }
          end

          sql = clauses.map(&:first).join(" OR ")
          binds = clauses.flat_map { |(_clause, account_id)| account_id }

          return Success(relation.where(sql, *binds))
        end

        Success(legacy_combined_names_filter(relation, account_names))
      end

      def account_filter_blank?(params)
        normalize_account_filter_names(params).empty? &&
          params[:account_id].blank?
      end

      def normalize_account_filter_names(params)
        names = Array(params[:account_names]).map(&:to_s).reject(&:blank?)
        return names if names.any?

        name = params[:account_name].to_s
        return [] if name.blank? || ["all", ""].include?(name)

        [name]
      end

      def resolve_filter_accounts(params, account_names)
        if params[:account_id].present?
          account = Transactions::Account.kept.find_by(
            id: params[:account_id],
            space_id: @space.id
          )
          return [account].compact
        end

        account_names.filter_map do |name|
          Transactions::Account.kept.find_by(
            name: name,
            space_id: @space.id
          )
        end.uniq
      end

      def legacy_combined_names_filter(relation, account_names)
        account_names.reduce(relation.none) do |scoped, name|
          scoped.or(legacy_combined_name_filter(relation, name))
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
