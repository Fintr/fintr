# frozen_string_literal: true

namespace :budgets do
  desc "Copy missing previous-month budget rows into recent months. " \
       "Pass MONTHS=3 to control how far back. Run on deploy after a missed month."
  task backfill_monthly: :environment do
    months = Integer(ENV.fetch("MONTHS", "3"))
    today = Utils::Dates.current_date_in_manila.to_date.beginning_of_month

    puts "Backfilling monthly budgets for the last #{months} month(s) through #{today}"

    Spaces::Space.find_each(batch_size: 100) do |space|
      months.times do |index|
        date = today - (months - 1 - index).months
        result = Budgets::Operations::CreateMonthlyBudget.new.call(
          space_id: space.id,
          date:
        )

        if result.success?
          created = result.value!.length
          puts "  #{space.code} #{date.strftime("%Y-%m")}: #{created} row(s)"
        else
          warn "  #{space.code} #{date.strftime("%Y-%m")}: FAILED #{result.failure}"
        end
      end
    end

    puts "Monthly budget backfill completed"
  end
end
