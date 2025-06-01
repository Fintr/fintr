# frozen_string_literal: true

ActiveRecord::Base.transaction do
  Spaces::Space.find_each do |space|
    puts "Seeding transactions for space: #{space.name}"
    Transactions::Account.where(space:).each do |account|
      puts "Seeding transactions for account: #{account.name}"
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
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].each do |month|
      puts "Seeding transactions for month: #{month}"
      (1..28).each do |day|
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
                  date: Date.new(2025, month, day),
                  description: ['Sample Description Income', 'Sample Long Description jknsfsdnfsdanflsakdfnlksadflkasdfmklsdfmksdfksadmflksmdkfl sakmdaksldmaskdm mklasmlkdmaskd klamskdmkalmdmkk mklmaskldmaklsdmklasmdkasmdasd'].sample,
                  balance: income_account.balance.amount + 1000,
                  balance_currency: 'PHP',
                  balance_state: Date.new(2025, month, day) <= Date.current ? :calculated : :pending,
                  schedule_type: :one_time
                )
        income.save ? puts("Saved income: #{income.value}") : puts("Failed to save income: #{income.errors.full_messages}")
        puts "Updating balance for income: #{income.value}"
        income.account.update(balance: income.account.balance + income.value)

        2.times do
          expense_amount = [500, 1000, 1500, 2000, 2500].sample
          expense = Transactions::Expense.new(
                      user: Auth::User.first,
                      space:,
                      amount: expense_amount,
                      amount_currency: 'PHP',
                      account: expense_account,
                      category: space.expense_categories.sample,
                      date: Date.new(2025, month, day),
                      balance: expense_account.balance.amount + expense_amount * -1,
                      balance_currency: 'PHP',
                      balance_state: Date.new(2025, month, day) <= Date.current ? :calculated : :pending,
                      schedule_type: :one_time
                    )
          expense.save ? puts("Saved expense: #{expense.value}") : puts("Failed to save expense: #{expense.errors.full_messages}")
          puts "Updating balance for expense: #{expense.value}"
          expense.account.update(balance: expense.account.balance + expense.value)
        end
      end
    end
  end
end
