# frozen_string_literal: true

# Installment split and revision math. Canonical behavior:
# docs/installment_plans.md
module Utils
  class InstallmentPlan
    ANCHORS = %w[total monthly explicit].freeze

    class << self
      include Dry::Monads[:result]

      def occurrence_dates(parent_date:, period:, from_date: nil)
        from = from_date || parent_date

        (0...period).map { |i| parent_date + i.months }.select { |d| d >= from }
      end

      def remaining_occurrence_dates(
        parent_date:,
        period:,
        effective_date:,
        calculated_dates: []
      )
        occurrence_dates(
          parent_date:,
          period:,
          from_date: effective_date,
        )
      end

      def frozen_occurrence_dates(
        parent_date:,
        period:,
        effective_date:,
        calculated_dates: []
      )
        occurrence_dates(
          parent_date:,
          period:,
        ).reject { |date| date >= effective_date }
      end

      def paid_so_far_cents(series_transactions:)
        series_transactions.where(balance_state: :calculated).sum(:amount_cents)
      end

      def resolve_installment_total_cents(root:, series_transactions: nil)
        return root.installment_total_cents if root.installment_total_cents.present?

        series = series_transactions || root.series_records
        summed_cents = series.sum(:amount_cents)
        return summed_cents if summed_cents.positive?

        if root.installment_period.present? && root.installment_period.positive?
          root.amount_cents * root.installment_period
        end
      end

      # Plan total lives on the series root. Child rows may carry a stale copy.
      def series_installment_total_cents(transaction:)
        root = transaction.respond_to?(:root_parent) ? transaction.root_parent : transaction
        root&.installment_total_cents.presence || transaction.installment_total_cents
      end

      def series_installment_total_amount(transaction:)
        cents = series_installment_total_cents(transaction:)
        return nil if cents.blank?

        Money.new(cents, transaction.amount_currency).amount
      end

      def to_ledger_amount(
        amount:,
        from_currency:,
        ledger_currency:,
        exchange_rate: nil
      )
        cents = to_ledger_cents(
          amount:,
          from_currency:,
          ledger_currency:,
          exchange_rate:,
        )
        return nil if cents.blank?

        Money.new(cents, ledger_currency).amount
      end

      def to_ledger_cents(
        amount:,
        from_currency:,
        ledger_currency:,
        exchange_rate: nil
      )
        return nil if amount.blank?

        from = from_currency.to_s.strip.upcase
        ledger = ledger_currency.to_s.strip.upcase
        rate =
          if exchange_rate.present?
            BigDecimal(exchange_rate.to_s)
          end
        ledger_amount =
          if from.present? &&
             ledger.present? &&
             from != ledger &&
             rate.present? &&
             rate.positive?
            (BigDecimal(amount.to_s) * rate).round(2)
          else
            BigDecimal(amount.to_s)
          end

        Money.from_amount(ledger_amount, ledger_currency).cents
      end

      def commitment_total_cents(
        parent_date:,
        period:,
        default_per_payment_cents:,
        occurrence_cents_by_date:
      )
        occurrence_dates(
          parent_date:,
          period:,
        ).sum do |date|
          occurrence_cents_by_date[date] ||
            occurrence_cents_by_date[date.iso8601] ||
            default_per_payment_cents
        end
      end

      def apply_this_only_amount_delta_cents(
        stored_total_cents:,
        period:,
        previous_amount_cents:,
        next_amount_cents:
      )
        delta = next_amount_cents.to_i - previous_amount_cents.to_i
        base =
          if stored_total_cents.present? && stored_total_cents.to_i.positive?
            stored_total_cents.to_i
          else
            previous_amount_cents.to_i * period.to_i
          end

        base + delta
      end

      def compute_revision(
        installment_total_cents:,
        currency:,
        new_period:,
        parent_date:,
        effective_date:,
        anchor:,
        paid_so_far_cents:,
        new_monthly_cents: nil,
        calculated_dates: [],
        prior_per_payment_cents: 0,
        occurrence_cents_by_date: {}
      )
        return Failure(anchor: "is invalid") unless ANCHORS.include?(anchor)

        remaining_dates = remaining_occurrence_dates(
          parent_date:,
          period: new_period,
          effective_date:,
          calculated_dates:,
        )
        remaining_count = remaining_dates.size
        if remaining_count.zero?
          return Failure(installment_period: "must leave at least one remaining payment")
        end

        frozen_dates = frozen_occurrence_dates(
          parent_date:,
          period: new_period,
          effective_date:,
        )
        occurrence_lookup = normalize_occurrence_cents_by_date(occurrence_cents_by_date)
        locked_cents = frozen_dates.sum do |date|
          occurrence_lookup[date] ||
            occurrence_lookup[date.iso8601] ||
            prior_per_payment_cents.to_i
        end
        paid_money = Money.new(locked_cents, currency)

        case anchor
        when "total"
          total_money = Money.new(installment_total_cents, currency)
          remaining_total = total_money - paid_money
          per_payment = divide_money_evenly(
            remaining_cents: remaining_total.cents,
            count: remaining_count,
          )
          new_total_cents = installment_total_cents
        when "monthly"
          monthly_cents = new_monthly_cents
          return Failure(amount: "is required for keep monthly revision") if monthly_cents.blank?

          new_total_cents = locked_cents + (monthly_cents * remaining_count)
          per_payment = Money.new(monthly_cents, currency).amount
        when "explicit"
          total_money = Money.new(installment_total_cents, currency)
          remaining_total = total_money - paid_money
          per_payment = divide_money_evenly(
            remaining_cents: remaining_total.cents,
            count: remaining_count,
          )
          new_total_cents = installment_total_cents
        end

        Success(
          installment_total_cents: new_total_cents,
          per_payment: per_payment,
          remaining_count: remaining_count,
          paid_so_far_cents: paid_so_far_cents,
        )
      end

      private

      def divide_money_evenly(remaining_cents:, count:)
        return BigDecimal("0") if count.zero?

        (remaining_cents.to_d / count / 100).round(2, BigDecimal::ROUND_HALF_UP)
      end

      def normalize_occurrence_cents_by_date(occurrence_cents_by_date)
        return {} if occurrence_cents_by_date.blank?

        occurrence_cents_by_date.each_with_object({}) do |(date, cents), lookup|
          next if cents.blank?

          key =
            case date
            when Date
              date
            when String
              Date.iso8601(date)
            else
              date.respond_to?(:to_date) ? date.to_date : date
            end
          lookup[key] = cents.to_i
          lookup[key.iso8601] = cents.to_i if key.respond_to?(:iso8601)
        end
      end
    end
  end
end
