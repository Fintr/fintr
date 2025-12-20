# frozen_string_literal: true

module Spaces
  class Space < ApplicationRecord
    FREE_TOKENS = 30

    has_many :transactions, class_name: "Transactions::Transaction", dependent: :destroy
    has_many :incomes, class_name: "Transactions::Income", dependent: :destroy
    has_many :expenses, class_name: "Transactions::Expense", dependent: :destroy
    has_many :transfers, class_name: "Transactions::Transfer", dependent: :destroy
    has_many :space_users, class_name: "Spaces::SpaceUser", dependent: :destroy
    has_many :users, class_name: "Auth::User", through: :space_users
    has_many :categories, class_name: "Transactions::Category", dependent: :destroy
    has_many :income_categories, -> { income }, class_name: "Transactions::Category"
    has_many :expense_categories, -> { expense }, class_name: "Transactions::Category"
    has_many :accounts, class_name: "Transactions::Account", dependent: :destroy
    has_many :budgets, class_name: "Budget", dependent: :destroy
    has_many :loans, class_name: "Transactions::Loan", dependent: :destroy
    has_many :entities, class_name: "Entities::Entity", dependent: :destroy
    has_many :tickets, class_name: "Crm::Ticket", dependent: :destroy
    has_one  :goal_description, class_name: "GoalDescription", dependent: :destroy
    has_many :conversations, class_name: "Ai::Conversation", dependent: :destroy
    has_many :imports, class_name: "Imports::Import", dependent: :destroy
    has_many :space_subscriptions, class_name: "Finance::SpaceSubscription", dependent: :destroy
    has_many :payment_methods, class_name: "Finance::PaymentMethod", dependent: :destroy

    validates :name, presence: true
    validates :code, presence: true, uniqueness: true
    validates :currency, presence: true
    validates :type, presence: true, inclusion: { in: %w[Spaces::PersonalSpace Spaces::OrganizationSpace] }

    def create_default_transaction_categories
      Transactions::Category.create_default_categories(self)
    end

    def can_ai?
      usages = Ai::Queries::Usages::UsageInPeriod.new.call(params: { space_id: id })
      return false unless usages.success?

      tokens_used = usages.value!.sum(:tokens_used)
      token_limit = current_token_limit
      return false if tokens_used >= token_limit

      true
    end

    def current_token_limit
      # Get all billing cycles that are active at the current time and paid
      # This includes cycles from active subscriptions, grace periods, and prorated cycles
      active_cycles = Finance::BillingCycle
                      .joins(:space_subscription)
                      .where(space_subscription: { space_id: id })
                      .active
                      .paid

      # Sum tokens from all active paid cycles
      total_tokens = active_cycles.sum(:tokens_allocated)

      FREE_TOKENS + total_tokens
    end
  end
end
