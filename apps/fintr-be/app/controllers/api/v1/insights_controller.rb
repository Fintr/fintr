# frozen_string_literal: true

module Api
  module V1
    class InsightsController < ApiController
      include InsightsEndpoint

      def index
        insights_data = Insights::Operations::CreateInsightsData.new.call(
          with_current_params(insights_index_params)
        )

        return render_insights_failure(insights_data) unless insights_data.success?

        render_success(data: insights_data.value!)
      end

      def summary
        render_insight_section do |context|
          Insights::Operations::CreateSummaryStructure.new.call(
            transactions: context[:transactions],
            space: context[:space]
          )
        end
      end

      def health_scores
        render_insight_section do |context|
          summary = Insights::Operations::CreateSummaryStructure.new.call(
            transactions: context[:transactions],
            space: context[:space]
          )
          return summary unless summary.success?

          Insights::Operations::CreateHealthScores.new.call(
            summary_structure: summary.value!,
            budget_records: context[:budget_records],
            transactions: context[:transactions],
            space: context[:space],
            period_days: context[:period_days]
          )
        end
      end

      def expense_breakdown
        render_insight_section do |context|
          Insights::Operations::CreateExpenseBreakdown.new.call(
            transactions: context[:transactions],
            space: context[:space]
          )
        end
      end

      def weekly_spending
        render_insight_section do |context|
          Insights::Operations::CreateWeeklySpending.new.call(
            transactions: context[:transactions],
            space: context[:space]
          )
        end
      end

      def monthly_spending
        render_insight_section do |context|
          Insights::Queries::MonthlySpending.call(
            params: {
              space_id: context[:space].id,
              date_from: 6.months.ago.beginning_of_month.to_date
            }
          )
        end
      end

      def account_breakdown
        render_insight_section do |context|
          Insights::Operations::CreateAccountBreakdown.new.call(space: context[:space])
        end
      end

      def narratives
        render_insight_section do |context|
          summary = Insights::Operations::CreateSummaryStructure.new.call(
            transactions: context[:transactions],
            space: context[:space]
          )
          return summary unless summary.success?

          health = Insights::Operations::CreateHealthScores.new.call(
            summary_structure: summary.value!,
            budget_records: context[:budget_records],
            transactions: context[:transactions],
            space: context[:space],
            period_days: context[:period_days]
          )
          return health unless health.success?

          Insights::Operations::CreateNarratives.new.call(
            space: context[:space],
            transactions: context[:transactions],
            prior_transactions: context[:prior_transactions],
            budgets: context[:budgets],
            budget_records: context[:budget_records],
            summary_structure: summary.value!,
            health_scores: health.value!,
            is_business: context[:is_business],
            start_date: context[:start_date],
            end_date: context[:end_date],
            period_days: context[:period_days]
          )
        end
      end

      private

      def render_insight_section
        context = resolve_insights_context
        return render_insights_failure(context) unless context.success?

        section = yield(context.value!)
        return render_insights_failure(section) unless section.success?

        render_success(data: section.value!)
      end
    end
  end
end
