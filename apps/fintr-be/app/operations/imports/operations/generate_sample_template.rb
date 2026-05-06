# frozen_string_literal: true

require "fast_excel"
require "fileutils"

module Imports
  module Operations
    class GenerateSampleTemplate < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_id).value(:string)
        end
      end

      include FailureHandler

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params = step validate(params:)
        space = step find_space(params[:space_id])
        tmp_dir = step ensure_tmp_directory
        file_path = step generate_file_path(tmp_dir:)
        _ = step create_workbook(space:, file_path:)

        { file_path: file_path.to_s }
      end

      private

      def find_space(space_id)
        space = Spaces::Space.find_by(id: space_id)
        return Failure(error: "Space not found") if space.nil?

        Success(space)
      end

      def ensure_tmp_directory
        tmp_dir = Rails.root.join("tmp")
        FileUtils.mkdir_p(tmp_dir) unless Dir.exist?(tmp_dir)
        Success(tmp_dir)
      end

      def generate_file_path(tmp_dir:)
        file_path = tmp_dir.join("import_template_#{SecureRandom.hex(8)}.xlsx")
        Success(file_path)
      end

      def create_workbook(space:, file_path:)
        workbook = FastExcel.open(file_path.to_s, constant_memory: true)
        worksheet = workbook.add_worksheet("Transactions")
        worksheet.auto_width = true

        _ = step add_headers(worksheet:)
        sample_rows = step generate_sample_rows(space:)
        _ = step add_sample_rows(worksheet:, sample_rows:)

        workbook.close

        Success(true)
      rescue StandardError => e
        Rails.logger.error("FastExcel error: #{e.class} - #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))
        Failure(error: "Failed to generate template: #{e.message}")
      end

      def add_headers(worksheet:)
        headers = ["date", "description", "amount", "type", "category"]
        worksheet.append_row(headers)
        Success(true)
      end

      def add_sample_rows(worksheet:, sample_rows:)
        sample_rows.each do |row|
          worksheet.append_row(row)
        end
        Success(true)
      end

      def generate_sample_rows(space:)
        income_categories = space.categories.income.limit(2).pluck(:name)
        expense_categories = space.categories.expense.limit(2).pluck(:name)

        income_categories = ["Salary", "Freelance"] if income_categories.empty?
        expense_categories = ["Food", "Transportation"] if expense_categories.empty?

        rows = [
          [
            Date.today.strftime("%Y-%m-%d"),
            "Salary Payment",
            "50000.00",
            "income",
            income_categories.first
          ],
          [
            (Date.today - 1.day).strftime("%Y-%m-%d"),
            "SM groceries",
            "2500.75",
            "expense",
            expense_categories.first
          ],
          [
            (Date.today - 2.days).strftime("%Y-%m-%d"),
            "Netflix Subscription",
            "549.99",
            "expense",
            expense_categories.last || "Subscriptions"
          ],
          [
            (Date.today - 3.days).strftime("%Y-%m-%d"),
            "Coffee Shop",
            "125.50",
            "expense",
            expense_categories.first
          ],
          [
            (Date.today - 4.days).strftime("%Y-%m-%d"),
            "Freelance Project",
            "15000.25",
            "income",
            income_categories.last || "Freelance"
          ]
        ]

        Success(rows)
      end
    end
  end
end
