# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Serializers
    class MonthlyFinancialSummarySerializer < Blueprinter::Base
      identifier :id

      fields :year,
             :month,
             :currency,
             :fx_based,
             :calculated_at

      field :total_income do |summary|
        Utils::Number.format_number(summary.total_income)
      end

      field :total_expenses do |summary|
        Utils::Number.format_number(summary.total_expenses)
      end

      field :net_savings do |summary|
        Utils::Number.format_number(summary.net_savings)
      end

      field :savings_percentage do |summary|
        summary.savings_percentage
      end

      field :month_start_date do |summary|
        Date.new(summary.year, summary.month, 1).iso8601
      end

      field :month_end_date do |summary|
        Date.new(summary.year, summary.month, 1).end_of_month.iso8601
      end
    end
  end
end
