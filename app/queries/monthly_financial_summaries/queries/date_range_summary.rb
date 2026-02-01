# frozen_string_literal: true

module MonthlyFinancialSummaries
  module Queries
    class DateRangeSummary < BaseQuery
      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
          required(:start_date).filled(:string)
          required(:end_date).filled(:string)
        end
      end

      def validate(params)
        result = Contract.new.call(**params)
        return Failure(result.errors.to_h) unless result.success?

        Success(result.to_h)
      end

      def call
        _ = step validate(params)
        space = step find_space
        date_range = step parse_dates
        transactions = step fetch_transactions(space:, date_range:)
        totals = step aggregate_totals(transactions:)
        numeric_values = step convert_to_numeric(totals:)
        summary = step build_summary(numeric_values:)
        summary
      end

      private

      def find_space
        space = Spaces::Space.find_by(code: params[:space_code])
        return Failure(space_code: "Space not found") if space.blank?

        Success(space)
      end

      def parse_dates
        start_date = Date.parse(params[:start_date])
        end_date = Date.parse(params[:end_date])
        
        Success({ start_date:, end_date: })
      rescue Date::Error => e
        Failure(date: "Invalid date format", error: e.message)
      end

      def fetch_transactions(space:, date_range:)
        transactions = space.transactions.where(
          date: date_range[:start_date]..date_range[:end_date].end_of_day
        ).calculated
        
        Success(transactions)
      rescue ActiveRecord::ActiveRecordError => e
        Failure(transactions: "Failed to fetch transactions", error: e.message)
      end

      def aggregate_totals(transactions:)
        total_income = Money.new(0, 'PHP')
        total_expenses = Money.new(0, 'PHP')

        transactions.each do |transaction|
          case transaction.type
          when 'Transactions::Income'
            total_income += transaction.amount
          when 'Transactions::Expense'
            total_expenses += transaction.amount
          end
          # Transfers don't affect income/expense totals
        end

        net_savings = total_income - total_expenses

        Success({ 
          total_income:, 
          total_expenses:, 
          net_savings: 
        })
      end

      def convert_to_numeric(totals:)
        total_income_amount = totals[:total_income].amount.to_f
        total_expenses_amount = totals[:total_expenses].amount.to_f
        net_savings_amount = totals[:net_savings].amount.to_f
        
        savings_percentage = if totals[:total_income].positive?
          ((net_savings_amount / total_income_amount) * 100).round(2)
        else
          0.0
        end

        Success({
          total_income: total_income_amount,
          total_expenses: total_expenses_amount,
          net_savings: net_savings_amount,
          savings_percentage:
        })
      end

      def build_summary(numeric_values:)
        summary = OpenStruct.new(
          total_income: numeric_values[:total_income],
          total_expenses: numeric_values[:total_expenses],
          net_savings: numeric_values[:net_savings],
          savings_percentage: numeric_values[:savings_percentage],
          calculated_at: Time.current
        )

        Success(summary)
      end
    end
  end
end
