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

    # Create sample transactions for current month only (not 12 months)
    current_month = Date.current.month
    puts "Seeding transactions for current month: #{current_month}"

    # Only seed 7 days of sample data instead of 28 days
    (1..7).each do |day|
      puts "Seeding transactions for day: #{day}"
      income_account = space.accounts.sample
      expense_account = space.accounts.sample

      income = Transactions::Income.new(
        user: Auth::User.first,
        space:,
        amount: 4000,
        amount_currency: 'PHP',
        account: income_account,
        category: space.income_categories.sample,
        date: Date.new(2025, current_month, day > Date.current.day ? Date.current.day : day),
        description: ['Sample Description Income', 'Sample Income'].sample,
        balance: income_account.balance.amount + 1000,
        balance_currency: 'PHP',
        balance_state: :calculated,
        schedule_type: :one_time
      )

      if income.save
        puts("Saved income: #{income.value}")
        income.account.update(balance: income.account.balance + income.value)
      end

      # Create only 1 expense instead of 2
      expense_amount = [500, 1000, 1500].sample
      expense = Transactions::Expense.new(
        user: Auth::User.first,
        space:,
        amount: expense_amount,
        amount_currency: 'PHP',
        account: expense_account,
        category: space.expense_categories.sample,
        date: Date.new(2025, current_month, day > Date.current.day ? Date.current.day : day),
        balance: expense_account.balance.amount + expense_amount * -1,
        balance_currency: 'PHP',
        balance_state: :calculated,
        schedule_type: :one_time
      )

      if expense.save
        puts("Saved expense: #{expense.value}")
        expense.account.update(balance: expense.account.balance + expense.value)
      end
    end
  end
end
