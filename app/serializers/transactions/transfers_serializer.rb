# frozen_string_literal: true

module Transactions
  class TransfersSerializer < BaseSerializer
    attributes :id,
               :amount,
               :transaction_cost,
               :date,
               :description,
               :schedule_type,
               :repeat_interval,
               :repeat_count,
               :balance_state,
               :created_at,
               :updated_at

    belongs_to :user, serializer: Auth::UserSerializer
    belongs_to :space, serializer: Spaces::SpaceSerializer
    belongs_to :from_account, serializer: Transactions::AccountSerializer
    belongs_to :to_account, serializer: Transactions::AccountSerializer

    def amount
      {
        amount: object.amount.amount,
        currency: object.amount.currency
      }
    end

    def transaction_cost
      {
        amount: object.transaction_cost.amount,
        currency: object.transaction_cost.currency
      }
    end
  end
end
