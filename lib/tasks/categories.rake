# frozen_string_literal: true

namespace :categories do
  desc "Add adjustment categories to existing spaces"
  task add_adjustment_categories: :environment do
    puts "Starting to add adjustment categories to all spaces..."

    space_count = 0
    error_count = 0

    Spaces::Space.find_each do |space|
      begin
        puts "Processing space: #{space.id} (#{space.name})"

        # Create Income Adjustment category
        income_category = Transactions::Category.find_or_create_by!(
          name: "Income Adjustment",
          space_id: space.id,
          category_type: "income"
        )
        puts "  ✓ Income Adjustment category: #{income_category.id}"

        # Create Expense Adjustment category
        expense_category = Transactions::Category.find_or_create_by!(
          name: "Expense Adjustment",
          space_id: space.id,
          category_type: "expense"
        )
        puts "  ✓ Expense Adjustment category: #{expense_category.id}"

        space_count += 1
      rescue StandardError => e
        puts "  ✗ Error processing space #{space.id}: #{e.message}"
        error_count += 1
      end
    end

    puts "\n" + "="*50
    puts "Completed!"
    puts "Spaces processed successfully: #{space_count}"
    puts "Spaces with errors: #{error_count}"
    puts "="*50
  end
end
