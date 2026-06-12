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
          record.account_category
        end
      end
    end
  end
end
