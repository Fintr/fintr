# frozen_string_literal: true

namespace :currency_conversions do
  desc "Set exchange_rate to the forward leg multiplier (converted/original) derived from stored amounts"
  task backfill_exchange_rates: :environment do
    updated = 0
    ExchangeRates::CurrencyConversion.find_each(batch_size: 200) do |conversion|
      forward = conversion.exchange_rate_as_multiplier
      next if forward <= 0

      conversion.update_columns(exchange_rate: forward.to_f)
      updated += 1
    end
    puts "Updated #{updated} currency_conversion rows."
  end

  desc "Fix JPY currency_conversion amounts in a given created_at window (start_date,end_date, e.g. 2026-03-08,2026-03-10)"
  task :fix_jpy_window, %i[start_date end_date] => :environment do |_t, args|
    unless args[:start_date].present? && args[:end_date].present?
      puts "Usage: rake currency_conversions:fix_jpy_window[START_DATE,END_DATE]"
      puts "Example: rake currency_conversions:fix_jpy_window[2026-03-08,2026-03-10]"
      exit 1
    end

    begin
      start_date = Date.parse(args[:start_date])
      end_date   = Date.parse(args[:end_date])
    rescue ArgumentError
      puts "Invalid date format. Use YYYY-MM-DD."
      exit 1
    end

    range = start_date.beginning_of_day..end_date.end_of_day

    scope =
      ExchangeRates::CurrencyConversion
        .where(created_at: range)
        .where("original_currency = ? OR converted_currency = ?", "JPY", "JPY")

    puts "Found #{scope.count} currency_conversions with JPY between #{range.first} and #{range.last}"

    scope.find_each(batch_size: 100) do |conversion|
      original_cents  = conversion.original_amount_cents
      converted_cents = conversion.converted_amount_cents

      new_original_cents  = original_cents
      new_converted_cents = converted_cents
      changed              = false

      if conversion.original_currency == "JPY" &&
         original_cents.present? &&
         (original_cents % 100).zero?
        new_original_cents = original_cents / 100
        changed            = true
      end

      if conversion.converted_currency == "JPY" &&
         converted_cents.present? &&
         (converted_cents % 100).zero?
        new_converted_cents = converted_cents / 100
        changed             = true
      end

      next unless changed

      puts "Fixing conversion #{conversion.id} (created_at=#{conversion.created_at}): " \
           "original #{original_cents} -> #{new_original_cents}, " \
           "converted #{converted_cents} -> #{new_converted_cents}"

      conversion.update_columns(
        original_amount_cents: new_original_cents,
        converted_amount_cents: new_converted_cents
      )
    end

    puts "Done."
  end
end
