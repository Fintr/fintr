# frozen_string_literal: true

namespace :monthly_financial_summaries do
  desc "Initialize monthly financial summaries for all spaces"
  task initialize: :environment do
    puts "Initializing monthly financial summaries..."

    Spaces::Space.find_each do |space|
      puts "Processing space: #{space.code}"

      # Get all unique year-month combinations for this space
      date_combinations = space.transactions
                              .where.not(transaction_date: nil)
                              .pluck("EXTRACT(YEAR FROM transaction_date) as year, EXTRACT(MONTH FROM transaction_date) as month")
                              .uniq

      date_combinations.each do |year, month|
        summary = MonthlyFinancialSummary.find_or_create_for_space_and_month(
          space:,
          year: year.to_i,
          month: month.to_i
        )

        summary.recalculate!
        puts "  Created/updated summary for #{year}-#{month.to_s.rjust(2, '0')}"
      end
    end

    puts "Monthly financial summaries initialization completed!"
  end

  desc "Recalculate all monthly financial summaries"
  task recalculate: :environment do
    puts "Recalculating all monthly financial summaries..."

    MonthlyFinancialSummary.find_each do |summary|
      summary.recalculate!
      puts "Recalculated summary for space #{summary.space.code} - #{summary.year}-#{summary.month.to_s.rjust(2, '0')}"
    end

    puts "Monthly financial summaries recalculation completed!"
  end

  desc "Clean up old monthly financial summaries (older than 2 years)"
  task cleanup: :environment do
    puts "Cleaning up old monthly financial summaries..."

    cutoff_date = 2.years.ago
    old_summaries = MonthlyFinancialSummary.where(
      "year < ? OR (year = ? AND month < ?)",
      cutoff_date.year,
      cutoff_date.year,
      cutoff_date.month
    )

    count = old_summaries.count
    old_summaries.destroy_all

    puts "Cleaned up #{count} old monthly financial summaries"
  end
end
