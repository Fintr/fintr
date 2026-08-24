# frozen_string_literal: true

module Transactions
  class Loan < ApplicationRecord
    include Versionable

    belongs_to :user, class_name: "Auth::User"
    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :entity, class_name: "Entities::Entity"
    belongs_to :account, class_name: "Transactions::Account"

    def entity_name
      entity&.full_name
    end

    has_many :loan_payments, dependent: :destroy
    has_many_attached :files
    has_one :rag_embedding, class_name: "Ai::RagEmbedding", as: :embeddable, dependent: :destroy

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
      attrs = { outstanding_balance_cents: new_balance }

      unless defaulted?
        if new_balance <= 0
          attrs[:status] = :paid_off
          attrs[:paid_off_date] = Date.current
        elsif status == "paid_off" && new_balance > 0
          attrs[:status] = :active
          attrs[:paid_off_date] = nil
        end
      end

      update!(attrs)
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

    def amount
      principal_amount
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

    # Income method - interest income for lent loans
    def income
      case loan_type
      when "borrowed"
        Money.from_amount(0, currency.presence || space.currency.presence || "PHP")
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
        Money.from_amount(0, currency.presence || space.currency.presence || "PHP")
      end
    end

    # Total value of the loan - sum of all scheduled payments (principal + total interest)
    # This represents the total amount that will be paid (for borrowed) or received (for lent)
    def total_value
      schedule = generate_amortization_schedule
      total_amount = schedule.sum { |entry| entry[:payment_amount] }
      Money.from_amount(total_amount, currency.presence || space.currency.presence || "PHP")
    end

    # Contractual due dates (loan date + 1 month, +2, …). Actual cash dates
    # do not move the next due date. Extra principal keeps the original PMT
    # and shortens remaining rows. Interest is daily simple (Actual/365).
    def generate_amortization_schedule(from_date = date, to_date = maturity_date)
      schedule = []

      principal = principal_amount
      monthly_rate = interest_rate / 100.0 / 12.0
      daily_rate = interest_rate / 100.0 / 365.0
      term_months = loan_term_months

      return schedule if principal.nil?
      return schedule if principal.cents <= 0
      return schedule if term_months.nil? || term_months <= 0
      return schedule if monthly_rate.nil? || monthly_rate < 0 || monthly_rate.nan?

      remaining_payments = loan_payments.where(date: from_date..to_date)
                                        .order(:date, :id)
                                        .to_a

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
      penny = Money.from_amount(0.01, currency)
      cover_tolerance_cents = 2

      current_balance = principal_amount
      last_interest_date = from_date
      due_date = from_date + 1.month

      term_months.times do
        break if current_balance <= penny
        break if due_date > to_date

        beginning_balance = Money.new((current_balance.cents / 100.0).round * 100, currency)
        days = (due_date - last_interest_date).to_i
        interest_payment = Money.new((beginning_balance.cents * daily_rate * days).round, currency)
        payoff_amount = beginning_balance + interest_payment
        installment_target = [fixed_monthly_payment, payoff_amount].min
        projected_principal = installment_target - interest_payment
        projected_principal = Money.from_amount(0, currency) if projected_principal.negative?

        covering_index = remaining_payments.find_index do |payment|
          payment.total_payment.cents >= installment_target.cents - cover_tolerance_cents
        end

        if covering_index
          payment = remaining_payments.delete_at(covering_index)
          ending_balance = beginning_balance - payment.principal_payment
          ending_balance = Money.from_amount(0, currency) if ending_balance.negative?

          schedule << {
            payment_date: due_date,
            beginning_balance: beginning_balance.amount,
            payment_amount: payment.total_payment.amount,
            principal_payment: payment.principal_payment.amount,
            interest_payment: payment.interest_payment.amount,
            ending_balance: ending_balance.amount,
            is_actual: true,
            paid_on: payment.date
          }

          current_balance = ending_balance
          last_interest_date = due_date
        else
          ending_balance = beginning_balance - projected_principal
          ending_balance = Money.from_amount(0, currency) if ending_balance.negative?

          schedule << {
            payment_date: due_date,
            beginning_balance: beginning_balance.amount,
            payment_amount: installment_target.amount,
            principal_payment: projected_principal.amount,
            interest_payment: interest_payment.amount,
            ending_balance: ending_balance.amount,
            is_actual: false
          }

          current_balance = ending_balance
          last_interest_date = due_date
        end

        due_date += 1.month
      end

      schedule
    end

    private

    def set_default_currency
      self.currency ||= space.currency.presence || "PHP"
    end
  end
end
