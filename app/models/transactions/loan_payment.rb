# frozen_string_literal: true

module Transactions
  class LoanPayment < ApplicationRecord
    belongs_to :loan, class_name: "Transactions::Loan"
    belongs_to :account, class_name: "Transactions::Account"
    belongs_to :transaction_record, class_name: "Transactions::Transaction", optional: true, foreign_key: :transaction_id

    monetize :principal_payment_cents, with_model_currency: :currency
    monetize :interest_payment_cents, with_model_currency: :currency
    monetize :total_payment_cents, with_model_currency: :currency

    validates :date, presence: true
    validates :principal_payment_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :interest_payment_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :total_payment_cents, presence: true, numericality: { greater_than: 0 }
    validates :account, presence: true

    # CRITICAL: Process payment and recalculate loan
    after_update :reprocess_payment
    after_destroy :recalculate_loan

    # Calculate interest for this specific payment period
    def calculate_interest_for_payment
      last_payment = loan.loan_payments
                        .where("date < ?", date)
                        .order(:date)
                        .last

      start_date = last_payment&.date || loan.date
      loan.calculate_interest_for_period(start_date, date)
    end

    # Auto-calculate principal and interest if not provided
    def auto_calculate_components!
      calculated_interest = calculate_interest_for_payment

      # If total payment covers interest + some principal
      if total_payment >= calculated_interest
        self.interest_payment_cents = calculated_interest.cents
        self.principal_payment_cents = (total_payment - calculated_interest).cents
      else
        # Payment only covers partial interest
        self.interest_payment_cents = total_payment_cents
        self.principal_payment_cents = 0
      end

      save!
    end

    def process_payment
      # Ensure components are calculated
      auto_calculate_components! if principal_payment_cents.zero? && interest_payment_cents.zero?

      # Recalculate loan balance
      loan.recalculate_outstanding_balance!

      # Create corresponding transaction entries for double-entry bookkeeping
      create_transaction_entries
    end

    def reprocess_payment
      # Recalculate everything if payment was modified
      loan.recalculate_outstanding_balance!
      update_transaction_entries
    end

    def recalculate_loan
      # Recalculate if payment was deleted
      loan.recalculate_outstanding_balance!
    end

    def create_transaction_entries
      # Create the actual transaction records for double-entry bookkeeping
      # This integrates with your existing transaction system
      # Implementation would depend on your transaction creation patterns
    end

    def update_transaction_entries
      # Update transaction entries if payment was modified
      # Implementation would depend on your transaction update patterns
    end
  end
end
