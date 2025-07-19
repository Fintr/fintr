# frozen_string_literal: true

ActiveRecord::Base.transaction do
  Spaces::Space.find_each do |space|
    # Skip if transactions already exist for this space
    if space.transactions.exists?
      puts "Skipping transaction seeding for space #{space.name} - transactions already exist"
      next
    end

    puts "Seeding transactions for space: #{space.name}"

    # Create initial balance transactions for each account
    Transactions::Account.where(space:).each do |account|
      puts "Seeding initial transaction for account: #{account.name}"
      income = Transactions::Income.create(
        user: Auth::User.first,
        space:,
        amount: 10000,
        amount_currency: 'PHP',
        account:,
        category: space.income_categories.find_by(name: 'Salary'),
        date: Date.new(2025, 1, 1)
      )
      account.update(balance: account.balance + income.value)
    end

    # Create sample transactions from 6 months ago to 6 months after current date
    start_date = 6.months.ago.to_date
    end_date = 6.months.from_now.to_date
    current_date = Date.current

    puts "Seeding transactions from #{start_date} to #{end_date}"

    # Seed transactions for each week in the date range (to avoid too many transactions)
    (start_date..end_date).step(7).each do |week_start|
      puts "Seeding transactions for week starting: #{week_start}"

      # Seed 2-3 transactions per week
      (0..2).each do |day_offset|
        transaction_date = week_start + day_offset.days
        next if transaction_date > end_date

        income_account = space.accounts.sample
        expense_account = space.accounts.sample

        # Determine balance state based on whether the transaction is in the future
        balance_state = transaction_date > current_date ? :pending : :calculated

        income = Transactions::Income.new(
          user: Auth::User.first,
          space:,
          amount: 4000,
          amount_currency: 'PHP',
          account: income_account,
          category: space.income_categories.sample,
          date: transaction_date,
          description: ['Sample Description Income', 'Sample Income'].sample,
          balance: income_account.balance.amount + 1000,
          balance_currency: 'PHP',
          balance_state: balance_state,
          schedule_type: :one_time
        )

        if income.save
          puts("Saved income: #{income.value} for #{transaction_date} (#{balance_state})")
          # Only update account balance for calculated transactions
          income.account.update(balance: income.account.balance + income.value) if balance_state == :calculated
        end

        # Create expense transaction
        expense_amount = [500, 1000, 1500].sample
        expense = Transactions::Expense.new(
          user: Auth::User.first,
          space:,
          amount: expense_amount,
          amount_currency: 'PHP',
          account: expense_account,
          category: space.expense_categories.sample,
          date: transaction_date,
          balance: expense_account.balance.amount + expense_amount * -1,
          balance_currency: 'PHP',
          balance_state: balance_state,
          schedule_type: :one_time
        )

        if expense.save
          puts("Saved expense: #{expense.value} for #{transaction_date} (#{balance_state})")
          # Only update account balance for calculated transactions
          expense.account.update(balance: expense.account.balance + expense.value) if balance_state == :calculated
        end
      end
    end
  end
end
