# frozen_string_literal: true

module Transactions
  class Transaction < ApplicationRecord
    include Repeatable

    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :category, class_name: "Transactions::Category"
    belongs_to :account, class_name: "Transactions::Account"
    belongs_to :parent, class_name: "Transactions::Transaction", optional: true
    belongs_to :effective_parent, class_name: "Transactions::Transaction", optional: true
    belongs_to :transfer, class_name: "Transactions::Transfer", optional: true
    has_one :loan_payment, class_name: "Transactions::LoanPayment", foreign_key: :transaction_id, dependent: :nullify
    has_many :children, class_name: "Transactions::Transaction", foreign_key: :parent_id, dependent: :nullify
    has_many :effective_children, class_name: "Transactions::Transaction", foreign_key: :effective_parent_id, dependent: :nullify

    has_many_attached :files
    has_one :rag_embedding, class_name: "Ai::RagEmbedding", as: :embeddable, dependent: :destroy

    monetize :amount_cents, allow_nil: false
    monetize :balance_cents, allow_nil: true

    enum :balance_state, {
      pending: "pending",
      calculated: "calculated"
    }

    # Required field validations
    validates :date, presence: true
    validates :amount_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :balance_cents, presence: true
    validates :type, presence: true

    scope :calculated, -> { where(balance_state: :calculated) }
    scope :pending, -> { where(balance_state: :pending) }
    scope :non_draft, -> { where.not(type: "Transactions::Draft") }
    scope :ordered, ->(direction: :asc) { order(date: direction, created_at: :desc) }

    def value
      amount
    end
  end
end
