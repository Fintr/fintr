# frozen_string_literal: true

module Transactions
  class AccountActivity < ApplicationRecord
    self.table_name = "account_activities"
    self.primary_key = "id"

    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :account, class_name: "Transactions::Account"
    belongs_to :activitable, polymorphic: true

    monetize :amount_cents, with_model_currency: :amount_currency, allow_nil: false
    monetize :balance_cents, with_model_currency: :balance_currency, allow_nil: true
    monetize :transaction_cost_cents, with_model_currency: :transaction_cost_currency, allow_nil: true

    def readonly? = true

    def in_series? = activitable.respond_to?(:in_series?) && activitable.in_series?
  end
end
