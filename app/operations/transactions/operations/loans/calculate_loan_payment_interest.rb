# frozen_string_literal: true

module Transactions
  module Operations
    module Loans
      class CalculateLoanPaymentInterest < Dry::Operation
        class Contract < Dry::Validation::Contract
          params do
            required(:loan).filled(type?: Transactions::Loan)
            required(:payment_date).filled
            optional(:exclude_payment_id).maybe(:string)
          end
        end

        def validate(params:)
          contract = Contract.new.call(**params)
          return Failure(contract.errors.to_h) unless contract.success?

          Success(contract.to_h)
        end

        include FailureHandler

        def call(params)
          params                    = step validate(params:)
          last_payment              = step find_last_payment_before_date(params:)
          start_date                = step determine_start_date(params:, last_payment:)
          payments_before_cents     = step calculate_payments_before_date(params:)
          balance_at_start          = step calculate_balance_at_start(params:, payments_before_cents:)
          total_interest_for_period = step calculate_interest_for_period(
                                         params:,
                                         start_date:,
                                         balance_at_start:
                                       )
          interest_already_paid     = step calculate_interest_already_paid_on_date(params:)
          calculated_interest       = step subtract_already_paid_interest(
                                         total_interest_for_period:,
                                         interest_already_paid:
                                       )
          calculated_interest
        end

        private

        # Finds the most recent loan payment that occurred before the given payment date.
        # This is used to determine the start date for interest calculation.
        # If exclude_payment_id is provided, that payment is excluded from the search
        # (useful when updating an existing payment).
        def find_last_payment_before_date(params:)
          loan = params[:loan]
          payment_date = params[:payment_date]
          exclude_payment_id = params[:exclude_payment_id]

          payments_query = loan.loan_payments.where("date < ?", payment_date)
          payments_query = payments_query.where.not(id: exclude_payment_id) if exclude_payment_id

          last_payment = payments_query.order(date: :desc, created_at: :desc).first

          Success(last_payment)
        end

        # Determines the start date for interest calculation.
        # Uses the date of the last payment before this payment, or falls back to the loan's start date
        # if this is the first payment.
        def determine_start_date(params:, last_payment:)
          Success(last_payment&.date || params[:loan].date)
        end

        # Calculates the total principal amount paid before the given payment date.
        # This sum is used to determine the remaining loan balance at the start of the interest period.
        # If exclude_payment_id is provided, that payment is excluded from the calculation.
        def calculate_payments_before_date(params:)
          payment_date = params[:payment_date]
          exclude_payment_id = params[:exclude_payment_id]

          payments_before_query = params[:loan].loan_payments.where("date < ?", payment_date)
          payments_before_query = payments_before_query.where.not(id: exclude_payment_id) if exclude_payment_id

          payments_before_cents = payments_before_query.sum(:principal_payment_cents)

          Success(payments_before_cents)
        end

        # Calculates the loan balance at the start of the interest period.
        # This is the original principal amount minus all principal payments made before this payment date.
        # The balance is returned as a Money object in the loan's currency.
        def calculate_balance_at_start(params:, payments_before_cents:)
          loan = params[:loan]
          balance_at_start_cents = loan.principal_amount_cents - payments_before_cents
          balance_at_start = Money.new(balance_at_start_cents, loan.currency)

          Success(balance_at_start)
        end

        # Calculates the interest for the payment period using daily simple interest.
        # Uses the loan's calculate_interest_for_period method which implements:
        # Daily Rate = Annual Rate ÷ 365
        # Interest = Beginning Balance × Daily Rate × Days
        # This accurately handles payments made early or late by using actual days between payments.
        def calculate_interest_for_period(params:, start_date:, balance_at_start:)
          loan = params[:loan]
          payment_date = params[:payment_date]

          calculated_interest = loan.calculate_interest_for_period(start_date, payment_date, balance_at_start)

          Success(calculated_interest)
        end

        # Calculates the total interest already paid by other payments on the same date.
        # This is used to prevent double-charging interest when multiple payments occur on the same date.
        # Payments are ordered by creation time (created_at) to determine which payments happened first.
        # If exclude_payment_id is provided, that payment is excluded from the calculation.
        def calculate_interest_already_paid_on_date(params:)
          loan = params[:loan]
          payment_date = params[:payment_date]
          exclude_payment_id = params[:exclude_payment_id]

          payments_on_same_date = loan.loan_payments.where(date: payment_date)
          payments_on_same_date = payments_on_same_date.where.not(id: exclude_payment_id) if exclude_payment_id

          # If this is a new payment (no exclude_payment_id), we want to check other payments
          # that were created before this one. Since we don't have the new payment's ID yet,
          # we check all payments on the same date and subtract their interest.
          # This works because when creating, the new payment isn't in the DB yet.
          # When updating, exclude_payment_id is provided, so we only check other payments.

          interest_already_paid_cents = payments_on_same_date.sum(:interest_payment_cents)
          interest_already_paid = Money.new(interest_already_paid_cents, loan.currency)

          Success(interest_already_paid)
        end

        # Subtracts any interest already paid on the same date from the total calculated interest.
        # This ensures that only the remaining unpaid interest is charged to this payment.
        # If all interest for the period has been paid, returns zero.
        def subtract_already_paid_interest(total_interest_for_period:, interest_already_paid:)
          remaining_interest = total_interest_for_period - interest_already_paid
          # Ensure we don't return negative interest
          remaining_interest = Money.from_amount(0, total_interest_for_period.currency) if remaining_interest.amount.negative?

          Success(remaining_interest)
        end
      end
    end
  end
end

