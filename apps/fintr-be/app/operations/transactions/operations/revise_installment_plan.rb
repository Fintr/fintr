# frozen_string_literal: true

module Transactions
  module Operations
    class ReviseInstallmentPlan < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:transaction).filled
          required(:update_scope).value(:string)
          required(:anchor).value(:string)
          optional(:installment_total).maybe(:decimal)
        end

        rule(:anchor) do
          key.failure("must be one of: #{Utils::InstallmentPlan::ANCHORS.join(", ")}") unless Utils::InstallmentPlan::ANCHORS.include?(value)
        end

        rule(:update_scope) do
          valid_scopes = %w[this_and_future all_in_series]
          key.failure("must be one of: #{valid_scopes.join(", ")}") unless valid_scopes.include?(value)
        end

        rule(:transaction) do
          key.failure("must be an installment transaction") unless value.installment?
        end
      end

      def call(params)
        params = step validate(params:)
        revision = step compute_revision(params:)
        transaction = step apply_revision(params:, revision:)
        transaction
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def compute_revision(params:)
        transaction = params[:transaction]
        root = transaction.root_parent
        series = root.series_records
        update_scope = params[:update_scope]
        effective_date = update_scope == "all_in_series" ? root.date : transaction.date
        paid_so_far_cents = Utils::InstallmentPlan.paid_so_far_cents(series_transactions: series)
        calculated_dates = series.where(balance_state: :calculated).pluck(:date)
        installment_total_cents = resolve_installment_total_cents(
          params:,
          root:,
          series:,
        )
        return Failure(installment_total: "could not be resolved") if installment_total_cents.blank?

        new_period = transaction.installment_period
        new_monthly_cents = transaction.amount_cents if params[:anchor] == "monthly"
        occurrence_cents_by_date = series.each_with_object({}) do |row, lookup|
          lookup[row.date] = row.amount_cents
        end
        frozen_unpaid_cents = series
          .where("date < ?", effective_date)
          .where.not(balance_state: :calculated)
          .pluck(:amount_cents)
        prior_per_payment_cents =
          frozen_unpaid_cents.min ||
          root.amount_cents ||
          transaction.amount_cents

        Utils::InstallmentPlan.compute_revision(
          installment_total_cents:,
          currency: transaction.amount_currency,
          new_period:,
          parent_date: root.date,
          effective_date:,
          anchor: params[:anchor],
          paid_so_far_cents:,
          new_monthly_cents:,
          calculated_dates:,
          prior_per_payment_cents:,
          occurrence_cents_by_date:,
        )
      end

      def resolve_installment_total_cents(params:, root:, series:)
        case params[:anchor]
        when "explicit"
          total = params[:installment_total]
          return nil if total.blank?

          Money.from_amount(total, root.amount_currency).cents
        else
          Utils::InstallmentPlan.resolve_installment_total_cents(
            root:,
            series_transactions: series,
          )
        end
      end

      def apply_revision(params:, revision:)
        transaction = params[:transaction]
        root = transaction.root_parent
        per_payment = revision[:per_payment]
        new_total_cents = revision[:installment_total_cents]
        effective_date =
          params[:update_scope] == "all_in_series" ? root.date : transaction.date
        per_payment_cents = Money.from_amount(
          per_payment,
          transaction.amount_currency,
        ).cents

        root.installment_total_cents = new_total_cents
        root.installment_period = transaction.installment_period
        root.amount = per_payment if root.id == transaction.id || transaction.date == root.date

        transaction.amount = per_payment
        transaction.installment_total_cents = new_total_cents

        if root.id != transaction.id
          root.save! if root.changed?
        end

        remaining_ids = remaining_series_scope(
          transaction:,
          root:,
          effective_date:,
        ).pluck(:id)

        Transactions::Transaction.where(id: remaining_ids).update_all(
          amount_cents: per_payment_cents,
          installment_total_cents: new_total_cents,
        )
        transaction.amount_cents = per_payment_cents
        transaction.installment_total_cents = new_total_cents

        Success(transaction)
      rescue ActiveRecord::ActiveRecordError => e
        Failure(error: e)
      end

      def remaining_series_scope(transaction:, root:, effective_date:)
        Transactions::Transaction.records_in_series_tree(
          root_id: root.id,
          extra_ids: [transaction.id],
        ).where(date: effective_date..)
      end
    end
  end
end
