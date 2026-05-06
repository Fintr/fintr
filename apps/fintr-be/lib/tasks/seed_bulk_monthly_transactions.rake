# frozen_string_literal: true

namespace :transactions do
  desc <<~DESC.squish
    Create 100 transactions per calendar month for the last 12 months in every space.
    Uses CreateTransaction (same rules as the app). Set CONFIRM=yes in production.
  DESC
  task seed_bulk_monthly: :environment do
    if Rails.env.production? && ENV["CONFIRM"].to_s != "yes"
      abort "Refusing to run in production without CONFIRM=yes"
    end

    records_per_month = ENV.fetch("RECORDS_PER_MONTH", "100").to_i
    months_count = ENV.fetch("MONTHS", "12").to_i
    first_month = Date.current.beginning_of_month - (months_count - 1).months

    expense_categories = Transactions::Category::DEFAULT_EXPENSE_CATEGORIES.dup
    income_categories = Transactions::Category::DEFAULT_INCOME_CATEGORIES.dup

    if expense_categories.empty? || income_categories.empty?
      abort "Default category lists are empty; cannot seed."
    end

    op = Transactions::Operations::CreateTransaction.new
    create_account = Transactions::Operations::Accounts::CreateAccount.new

    total_ok = 0
    total_fail = 0

    Spaces::Space.find_each do |space|
      space.create_default_transaction_categories

      user_id = space.owner_id&.to_s
      if user_id.blank?
        member = space.space_users.where.not(user_id: nil).first
        user_id = member&.user_id&.to_s
      end

      if user_id.blank?
        puts "[SKIP] #{space.id} (#{space.name}): no owner or member user"
        next
      end

      account = space.accounts.kept.first
      if account.blank?
        result = create_account.call(
          user_id:,
          space_id: space.id.to_s,
          name: "Seed Cash",
          balance: BigDecimal("0"),
          account_category: "cash",
        )
        unless result.success?
          puts "[SKIP] #{space.id}: could not create account — #{result.failure}"
          next
        end
        account = result.value!
      end

      months_count.times do |month_index|
        month_start = first_month + month_index.months
        days_in_month = Time.days_in_month(month_start.month, month_start.year)

        records_per_month.times do |i|
          on_day = 1 + (i % days_in_month)
          tx_date = Date.new(month_start.year, month_start.month, on_day)

          expense = i.even?
          transaction_type = expense ? "expense" : "income"
          pool = expense ? expense_categories : income_categories
          category_name = pool[i % pool.length]
          amount = BigDecimal(((i % 450) + 50).to_s) / BigDecimal("1")

          params = {
            user_id:,
            space_id: space.id.to_s,
            account_id: account.id.to_s,
            amount:,
            date: tx_date,
            transaction_type:,
            category_name:,
            schedule_type: "one_time",
            description: "Bulk seed #{tx_date.iso8601} ##{i + 1}",
            skip_embedding: true
          }

          outcome = op.call(params)
          if outcome.success?
            total_ok += 1
          else
            total_fail += 1
            puts "[FAIL] space=#{space.id} date=#{tx_date} #{outcome.failure}"
          end
        end
      end

      puts "[OK] Space #{space.id} (#{space.name}): #{months_count * records_per_month} attempts"
    end

    puts "Done. successes=#{total_ok} failures=#{total_fail}"
  end
end
