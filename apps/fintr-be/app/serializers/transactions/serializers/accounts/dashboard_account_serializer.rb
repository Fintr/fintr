# frozen_string_literal: true

module Transactions
  module Serializers
    module Accounts
      class DashboardAccountSerializer < Blueprinter::Base
        identifier :id

        fields :name

        field :balance do |record|
          record.balance.amount
        end

        field :balance_currency do |record|
          record.balance_currency
        end

        field :account_category do |record|
          Transactions::Account::ACCOUNT_CATEGORY_LABELS[record.account_category.to_sym]
        end
      end
    end
  end
end
