# frozen_string_literal: true

class TestBackgroundJob < ApplicationJob
  def perform
    # Find the first user to create the transaction for
    user = Auth::User.find_by(email: "miguel.dagatan@gmail.com")
    return unless user

    # Find the first space for this user
    space = user.spaces.first
    return unless space

    # Find the first category and account for this space
    category = space.expense_categories.first
    return unless category

    account = space.accounts.first
    return unless account

    # Create a test expense transaction
    Transactions::Expense.create!(
      description: "Testing Background jobs",
      amount_cents: 100, # $1.00
      amount_currency: "PHP",
      balance_cents: 0,
      balance_currency: "PHP",
      date: Date.current,
      space: space,
      user: user,
      category: category,
      account: account,
      schedule_type: "one_time",
      balance_state: "pending"
    )

    Rails.logger.info "TestBackgroundJob executed successfully - Created test transaction"
  rescue => e
    Rails.logger.error "TestBackgroundJob failed: #{e.message}"
    raise e
  end
end
