# frozen_string_literal: true

module Transactions
  class LoanPayment < ApplicationRecord
    include Versionable
    include HasCurrencyConversion

    belongs_to :loan, class_name: "Transactions::Loan"
    belongs_to :account, class_name: "Transactions::Account"
    belongs_to :transaction_record, class_name: "Transactions::Transaction", optional: true, foreign_key: :transaction_id

    delegate :space_id, :space, to: :loan, allow_nil: true

    monetize :principal_payment_cents, with_model_currency: :currency
    monetize :interest_payment_cents, with_model_currency: :currency
    monetize :total_payment_cents, with_model_currency: :currency

    validates :date, presence: true
    validates :principal_payment_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :interest_payment_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :total_payment_cents, presence: true, numericality: { greater_than: 0 }
    validates :account, presence: true

    def value
      total_payment
    end

    def amount
      total_payment
    end

    def amount_currency
      currency
    end

    def in_series?
      false
    end

    def amount_in_space_currency
      @amount_in_space_currency ||= ::ExchangeRates::Operations::AmountInSpaceForTransactable.display_payload(
        transactable: self,
      )
    end

    def amount_numeric_for_space_total
      @amount_numeric_for_space_total ||= ::ExchangeRates::Operations::AmountInSpaceForTransactable.totals_amount_decimal(
        transactable: self,
      )
    end

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
    end

    def reprocess_payment
      # Recalculate everything if payment was modified
      loan.recalculate_outstanding_balance!
    end

    def recalculate_loan
      # Recalculate if payment was deleted
      loan.recalculate_outstanding_balance!
    end
  end
end
