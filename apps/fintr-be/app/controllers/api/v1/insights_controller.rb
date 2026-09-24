# frozen_string_literal: true

module Api
  module V1
    class InsightsController < ApiController
      include InsightsEndpoint

      before_action :require_pro_access,
                    only: %i[
                      index
                      health_scores
                      expense_breakdown
                      weekly_spending
                      account_breakdown
                    ]

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
            summary_structure_params(context)
          )
        end
      end

      def health_scores
        render_insight_section do |context|
          summary = Insights::Operations::CreateSummaryStructure.new.call(
            summary_structure_params(context)
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
          period_end = (context[:end_date] || Time.zone.today).to_date
          Insights::Queries::MonthlySpending.call(
            params: {
              space_id: context[:space].id,
              # Six months ending on the filtered month (inclusive).
              date_from: (period_end.beginning_of_month - 5.months),
              date_to: period_end.end_of_month
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
          narratives = Insights::Operations::CreateNarratives.new.call(
            space: context[:space],
            transactions: context[:transactions],
            prior_transactions: context[:prior_transactions],
            budgets: context[:budgets],
            budget_records: context[:budget_records],
            is_business: context[:is_business],
            start_date: context[:start_date],
            end_date: context[:end_date],
            period_days: context[:period_days],
            category_filtered: context[:category_filtered]
          )
          present_narratives(narratives:)
        end
      end

      private

      PRO_FEATURE_NAMES = {
        "index" => "Dashboard Insights",
        "health_scores" => "Financial Health Score",
        "expense_breakdown" => "Expense Breakdown",
        "weekly_spending" => "Weekly Spending",
        "account_breakdown" => "Dashboard Insights",
      }.freeze

      def require_pro_access
        return if pro_access_allowed?

        render_error(
          message: "Fintr Pro is required for #{PRO_FEATURE_NAMES.fetch(action_name)}.",
          status: :forbidden,
        )
      end

      def present_narratives(narratives:)
        return narratives unless narratives.success?
        return narratives if pro_access_allowed?

        Dry::Monads::Success(
          narratives.value!.merge(insights: [])
        )
      end

      def pro_access_allowed?
        ::Finance::ProGate.require!(
          user_id: current_user.id,
          space_id: current_space.id,
        ).success?
      end

      def summary_structure_params(context)
        {
          space: context[:space],
          start_date: context[:start_date],
          end_date: context[:end_date],
          category_filtered: context[:category_filtered],
          transactions: context[:transactions]
        }
      end

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
