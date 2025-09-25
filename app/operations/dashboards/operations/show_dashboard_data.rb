# frozen_string_literal: true

module Dashboards
  module Operations
    class ShowDashboardData < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:space_code).value(:string)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def call(params)
        params = step validate(params:)
        dashboard_data = step get_dashboard_data(params:)
        financial_summary = step get_financial_summary(params:)
        combined_data = step combine_data(dashboard_data:, financial_summary:)
        combined_data
      end

      private

      def get_dashboard_data(params:)
        Spaces::Queries::DashboardData.call(params:)
      end

      def get_financial_summary(params:)
        MonthlyFinancialSummaries::Queries::CurrentMonthSummary.call(params:)
      end

      def combine_data(dashboard_data:, financial_summary:)
        # Serialize the space model using the DashboardSerializer
        serialized_dashboard = Spaces::Serializers::DashboardSerializer.render_as_hash(dashboard_data)

        combined_data = {
          **serialized_dashboard,
          financial_summary: {
            total_income: Utils::Number.format_number(financial_summary.total_income),
            total_expenses: Utils::Number.format_number(financial_summary.total_expenses),
            net_savings: Utils::Number.format_number(financial_summary.net_savings),
            savings_percentage: financial_summary.savings_percentage,
            calculated_at: financial_summary.calculated_at
          }
        }

        Success(combined_data)
      end
    end
  end
end
