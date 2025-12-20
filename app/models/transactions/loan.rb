# frozen_string_literal: true

module Transactions
  class Loan < ApplicationRecord
    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :entity, class_name: "Entities::Entity"
    belongs_to :account, class_name: "Transactions::Account"

    has_many :loan_payments, dependent: :destroy
    has_many_attached :files
    has_one :rag_embedding, class_name: "Ai::RagEmbedding", as: :embeddable

    monetize :principal_amount_cents, with_model_currency: :currency
    monetize :outstanding_balance_cents, with_model_currency: :currency

    validates :interest_rate, presence: true,
                              numericality: { greater_than_or_equal_to: 0, less_than: 100 }
    validates :currency, presence: true
    validates :principal_amount_cents, presence: true, numericality: { greater_than: 0 }
    validates :outstanding_balance_cents, presence: true
    validates :loan_term_months, presence: true, numericality: { greater_than: 0 }
    validates :date, presence: true
    validates :maturity_date, presence: true

    enum :loan_type, {
      borrowed: "borrowed",
      lent: "lent"
    }

    enum :status, {
      active: "active",
      paid_off: "paid_off",
      defaulted: "defaulted"
    }

    # Set default currency before validation
    before_validation :set_default_currency

    # Calculate interest based on actual days and current balance
    # Uses daily simple interest accrual, which is the industry standard for loans
    # This method accurately handles payments made early or late by calculating
    # interest based on the actual number of days between payments
    # Formula: Daily Interest = (Annual Rate / 365) × Balance × Days
    # References:
    # - U.S. Treasury uses: P × (r/360 × d) for daily simple interest
    # - Bank of America, student loans, auto loans all use daily accrual
    # - This ensures fairness: early payments reduce interest, late payments accrue more
    # Calculate interest for a specific period using daily simple interest
    # Formula: Interest = Principal × Daily Rate × Days
    # - Daily Rate = Annual Rate ÷ 365 (industry standard)
    # - This ensures fairness: early payments reduce interest, late payments accrue more
    # References:
    # - U.S. Treasury uses: P × (r/360 × d) for daily simple interest
    # - Many banks and financial institutions use 365 days for daily accrual
    # - Bank of America, student loans, auto loans all use daily accrual with 365 days
    def calculate_interest_for_period(start_date, end_date, balance = nil)
      balance ||= outstanding_balance
      days = (end_date - start_date).to_i
      # Industry standard: 365 days per year for daily simple interest
      daily_rate = interest_rate / 100.0 / 365.0
      balance * daily_rate * days
    end

    # Recalculate outstanding balance after any payment
    def recalculate_outstanding_balance!
      total_paid = loan_payments.sum(:principal_payment_cents)
      new_balance = principal_amount_cents - total_paid
      update!(outstanding_balance_cents: new_balance)

      if new_balance <= 0
        update!(status: :paid_off, paid_off_date: Date.current)
      elsif status == "paid_off" && new_balance > 0
        update!(status: :active, paid_off_date: nil)
      end
    end

    # Value method - opposite for borrowed vs lent
    def value
      case loan_type
      when "borrowed"
        -outstanding_balance  # Negative for liability
      when "lent"
        outstanding_balance   # Positive for asset
      end
    end

    # Income method - interest income for lent loans
    def income
      case loan_type
      when "borrowed"
        Money.from_amount(0, currency || "PHP")
      when "lent"
        calculate_interest_for_period(date, Date.current)
      end
    end

    # Expense method - interest expense for borrowed loans
    def expense
      case loan_type
      when "borrowed"
        calculate_interest_for_period(date, Date.current)
      when "lent"
        Money.from_amount(0, currency || "PHP")
      end
    end

    # Generate amortization schedule accounting for actual payments made
    # This calculates the schedule from actual payments made, then projects remaining payments
    #
    # Note on interest calculation methods:
    # - For ACTUAL payments: Uses daily simple interest (calculate_interest_for_period)
    #   to accurately handle variable payment dates (early/late payments)
    # - For PROJECTED payments: Also uses daily simple interest with actual days between
    #   projected payment dates to ensure consistency when a payment is actually made
    # - Fixed monthly payment (PMT formula) is used for payment amount calculation
    # Both use industry standard 365 days per year for daily rate calculation
    # This ensures the schedule matches actual payment calculations exactly
    def generate_amortization_schedule(from_date = date, to_date = maturity_date)
      schedule = []

      # Use Money objects for calculations
      principal = principal_amount
      # Monthly rate is used for amortization formula (PMT calculation)
      # This calculates the standard fixed monthly payment assuming monthly intervals
      monthly_rate = interest_rate / 100.0 / 12.0
      # Daily rate for interest calculations (industry standard: 365 days)
      daily_rate = interest_rate / 100.0 / 365.0
      term_months = loan_term_months

      # Early return checks
      return schedule if principal.nil?
      return schedule if principal.cents <= 0
      return schedule if term_months.nil? || term_months <= 0
      return schedule if monthly_rate.nil? || monthly_rate < 0 || monthly_rate.nan?

      # Get actual payments made, ordered by date
      actual_payments = loan_payments.where(date: from_date..to_date).order(:date).to_a

      # Calculate fixed monthly payment for projection
      principal_amount_float = principal.amount.to_f

      if monthly_rate == 0
        fixed_monthly_payment_float = principal_amount_float / term_months
      else
        one_plus_rate = 1 + monthly_rate
        power_result = one_plus_rate**term_months
        numerator = monthly_rate * power_result
        denominator = power_result - 1
        return schedule if denominator <= 0 || denominator.nan?
        fixed_monthly_payment_float = principal_amount_float * (numerator / denominator)
      end

      fixed_monthly_payment_cents = (fixed_monthly_payment_float * 100).round
      fixed_monthly_payment = Money.new(fixed_monthly_payment_cents, currency)

      # Track current balance and date
      # Start with principal amount to show full payment history
      current_balance = principal_amount
      # First payment is one month after loan date
      projected_payment_date = from_date + 1.month

      # Track how many projected payments we've generated (not counting actual payments)
      projected_payment_count = 0
      # Track the last payment date for calculating days between payments
      last_payment_date = from_date

      # Process actual payments first
      actual_payments.each do |payment|
        # Generate projected payments up to this actual payment date
        while projected_payment_date < payment.date &&
              current_balance > Money.from_amount(0.01, currency) &&
              projected_payment_count < term_months
          beginning_balance = Money.new((current_balance.cents / 100.0).round * 100, currency)
          # Use daily simple interest for consistency with actual payment calculations
          days = (projected_payment_date - last_payment_date).to_i
          interest_payment = Money.new((beginning_balance.cents * daily_rate * days).round, currency)

          # Calculate principal payment
          if beginning_balance <= Money.from_amount(0.01, currency)
            break
          end

          payment_amount = fixed_monthly_payment
          principal_payment = Money.new((payment_amount.cents - interest_payment.cents).round, currency)

          if principal_payment > beginning_balance
            principal_payment = beginning_balance
            payment_amount = principal_payment + interest_payment
          end

          ending_balance = Money.new([0, (beginning_balance.cents - principal_payment.cents)].max, currency)

          schedule << {
            payment_date: projected_payment_date,
            beginning_balance: beginning_balance.amount,
            payment_amount: payment_amount.amount,
            principal_payment: principal_payment.amount,
            interest_payment: interest_payment.amount,
            ending_balance: ending_balance.amount,
            is_actual: false
          }

          current_balance = ending_balance
          last_payment_date = projected_payment_date
          projected_payment_date = projected_payment_date + 1.month
          projected_payment_count += 1
        end

        # Add the actual payment
        beginning_balance = Money.new((current_balance.cents / 100.0).round * 100, currency)

        schedule << {
          payment_date: payment.date,
          beginning_balance: beginning_balance.amount,
          payment_amount: payment.total_payment.amount,
          principal_payment: payment.principal_payment.amount,
          interest_payment: payment.interest_payment.amount,
          ending_balance: (beginning_balance - payment.principal_payment).amount,
          is_actual: true
        }

        current_balance = beginning_balance - payment.principal_payment
        last_payment_date = payment.date
        # Update projected payment date to one month after the actual payment
        projected_payment_date = payment.date + 1.month
      end

      # Generate remaining projected payments
      # Generate up to term_months total projected payments (actual payments don't count toward this limit)
      while current_balance > Money.from_amount(0.01, currency) &&
            projected_payment_date <= to_date &&
            projected_payment_count < term_months

        beginning_balance = Money.new((current_balance.cents / 100.0).round * 100, currency)
        # Use daily simple interest for consistency with actual payment calculations
        days = (projected_payment_date - last_payment_date).to_i
        interest_payment = Money.new((beginning_balance.cents * daily_rate * days).round, currency)

        # Check if this should be the last payment
        # We're at the last payment if balance is small enough or we've reached maturity
        is_last = (projected_payment_date >= to_date) ||
                  (beginning_balance <= fixed_monthly_payment) ||
                  (current_balance <= fixed_monthly_payment)

        if is_last
          principal_payment = beginning_balance
          payment_amount = principal_payment + interest_payment
        else
          payment_amount = fixed_monthly_payment
          principal_payment = Money.new((payment_amount.cents - interest_payment.cents).round, currency)

          if principal_payment > beginning_balance
            principal_payment = beginning_balance
            payment_amount = principal_payment + interest_payment
          end
        end

        ending_balance = Money.new([0, (beginning_balance.cents - principal_payment.cents)].max, currency)

        schedule << {
          payment_date: projected_payment_date,
          beginning_balance: beginning_balance.amount,
          payment_amount: payment_amount.amount,
          principal_payment: principal_payment.amount,
          interest_payment: interest_payment.amount,
          ending_balance: ending_balance.amount,
          is_actual: false
        }

        current_balance = ending_balance
        last_payment_date = projected_payment_date
        projected_payment_date = projected_payment_date + 1.month
        projected_payment_count += 1

        break if current_balance <= Money.from_amount(0.01, currency)
      end

      schedule
    end

    private

    def set_default_currency
      self.currency ||= "PHP"
    end
  end
end
