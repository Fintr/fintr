# frozen_string_literal: true

module ExchangeRates
  # One-off or nightly job: ensure api_exchange_rates has rates for all transaction dates
  # so that "amount in space currency" can be computed without hitting the external API on read.
  # Run once for past data, or schedule daily after SyncDailyRatesJob.
  class BackfillRatesForTransactionsJob < ApplicationJob
    queue_as :default

    BATCH_SIZE = 100

    def perform(space_id: nil)
      pairs = distinct_currency_pairs_and_dates(space_id: space_id)
      return if pairs.empty?

      synced = 0
      pairs.each do |from_currency, to_currency, date|
        next if from_currency == to_currency

        result = ::ExchangeRates::Operations::FetchRate.new.call(
          from_currency: from_currency,
          to_currency: to_currency,
          date: date,
          space_id: space_id
        )
        synced += 1 if result.success?
      end
      Rails.logger.info("[BackfillRatesForTransactionsJob] Ensured rates for #{synced}/#{pairs.size} (from_currency, to_currency, date) pairs")
    end

    private

    def distinct_currency_pairs_and_dates(space_id: nil)
      # (from_currency, to_currency, date) where from = transaction amount_currency, to = space currency; only when they differ.
      tx_rel = Transactions::Transaction.joins(:space).where.not(amount_currency: nil)
      tx_rel = tx_rel.where(space_id: space_id) if space_id.present?
      tx_pairs = tx_rel.pluck(:amount_currency, "spaces.currency", :date).uniq
        .map { |from, to, date| [from.presence || "PHP", (to.presence || "PHP"), date] }
        .reject { |from, to, _| from == to }

      tr_rel = Transactions::Transfer.joins(:space).where.not(amount_currency: nil)
      tr_rel = tr_rel.where(space_id: space_id) if space_id.present?
      tr_pairs = tr_rel.pluck(:amount_currency, "spaces.currency", :date).uniq
        .map { |from, to, date| [from.presence || "PHP", (to.presence || "PHP"), date] }
        .reject { |from, to, _| from == to }

      (tx_pairs + tr_pairs).uniq
    end
  end
end
