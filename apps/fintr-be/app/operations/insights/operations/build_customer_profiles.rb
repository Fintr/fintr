# frozen_string_literal: true

module Insights
  module Operations
    class BuildCustomerProfiles < Dry::Operation
      INVESTMENT_CATEGORY_PATTERN =
        /invest|stocks?|crypto|mutual\s*fund|etf|brokerage|securities|portfolio/i
      PROFILE_PRIORITY = %w[
        strong_saver
        debt_crusher
        steady_investor
        high_earner
        balanced_budgeter
        avid_spender
      ].freeze
      INVESTMENT_FLOOR_UNITS = BigDecimal("1000")
      HIGH_EARNER_INCOME_LIFT = BigDecimal("15")
      AVID_SPENDER_EXPENSE_SHARE = BigDecimal("70")
      STRONG_SAVER_RATE = BigDecimal("20")
      HEALTHY_DEBT_RATIO_MAX = BigDecimal("30")

      class Contract < Dry::Validation::Contract
        params do
          required(:space)
          required(:transactions)
          required(:prior_transactions)
          required(:budget_records)
          required(:summary_structure)
          required(:is_business).value(:bool)
          required(:period_days).value(:integer)
          required(:start_date).value(:date)
          required(:end_date).value(:date)
          required(:completeness_tier).value(:string)
        end
      end

      def call(params)
        params = step validate(params:)
        step evaluate_profiles(params:)
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def evaluate_profiles(params:)
        return Success([]) if params[:completeness_tier] == "sparse"

        space = params[:space]
        summary = params[:summary_structure]
        income = decimal_from(summary[:total_income])
        expenses = decimal_from(summary[:total_expenses])
        net = decimal_from(summary[:net_savings])
        prior_income = prior_period_income(params:)
        savings_rate = income.zero? ? 0.to_d : (net / income * 100)

        candidates = []
        candidates << strong_saver_card(
          is_business: params[:is_business],
          savings_rate:
        )
        candidates << debt_crusher_card(
          space:,
          summary_structure: summary,
          period_days: params[:period_days],
          is_business: params[:is_business]
        )
        candidates << steady_investor_card(
          space:,
          transactions: params[:transactions],
          income:,
          start_date: params[:start_date],
          end_date: params[:end_date],
          is_business: params[:is_business]
        )
        candidates << high_earner_card(
          income:,
          prior_income:,
          is_business: params[:is_business],
          currency: space.currency
        )
        candidates << balanced_budgeter_card(
          space:,
          budget_records: params[:budget_records],
          transactions: params[:transactions],
          is_business: params[:is_business]
        )
        candidates << avid_spender_card(
          income:,
          expenses:,
          net:,
          is_business: params[:is_business]
        )

        ordered = candidates.compact.sort_by do |card|
          PROFILE_PRIORITY.index(card[:profile_key]) || PROFILE_PRIORITY.length
        end
        Success(ordered)
      end

      def strong_saver_card(is_business:, savings_rate:)
        return nil if savings_rate < STRONG_SAVER_RATE

        profile_card(
          profile_key: "strong_saver",
          title: is_business ? "Healthy Margin" : "Strong Saver",
          body: "You retained #{Utils::Number.format_percentage(savings_rate)} of #{is_business ? 'revenue' : 'income'} this period — outstanding buffer-building.",
          action_label: "View transactions",
          action_href: "/dashboard"
        )
      end

      def debt_crusher_card(space:, summary_structure:, period_days:, is_business:)
        total_income = decimal_from(summary_structure[:total_income])
        monthly_income = total_income / [period_days.to_d / 30, 1].max
        return nil if monthly_income.zero?

        monthly_debt = Insights::MonthlyDebtPayments.total_for_space(space:)
        return nil if monthly_debt.zero?

        ratio = (monthly_debt / monthly_income) * 100
        return nil if ratio >= HEALTHY_DEBT_RATIO_MAX

        profile_card(
          profile_key: "debt_crusher",
          title: is_business ? "Debt Service Healthy" : "Debt Crusher",
          body: "Debt payments are only #{Utils::Number.format_percentage(ratio)} of monthly income — you’re in a strong repayment zone.",
          action_label: "View loans",
          action_href: "/dashboard/loans"
        )
      end

      def steady_investor_card(space:, transactions:, income:, start_date:, end_date:, is_business:)
        invested = investment_activity_amount(
          space:,
          transactions:,
          start_date:,
          end_date:
        )
        floor = [INVESTMENT_FLOOR_UNITS, income * BigDecimal("0.05")].max
        return nil if invested < floor

        profile_card(
          profile_key: "steady_investor",
          title: is_business ? "Capital Deployed" : "Steady Investor",
          body: "You put #{format_money(invested, space.currency)} toward investments this period — future-you is cheering.",
          action_label: "View accounts",
          action_href: "/dashboard"
        )
      end

      def high_earner_card(income:, prior_income:, is_business:, currency:)
        return nil if income.zero? || prior_income.zero?

        lift = ((income - prior_income) / prior_income) * 100
        return nil if lift < HIGH_EARNER_INCOME_LIFT

        profile_card(
          profile_key: "high_earner",
          title: is_business ? "Revenue Climb" : "High Earner",
          body: "#{is_business ? 'Revenue' : 'Income'} rose #{Utils::Number.format_percentage(lift)} vs the prior period (#{format_money(income, currency)}) — celebrate the climb.",
          action_label: "View transactions",
          action_href: "/dashboard"
        )
      end

      def balanced_budgeter_card(space:, budget_records:, transactions:, is_business:)
        return nil if budget_records.blank?

        usage_result = Insights::Operations::ComputeBudgetUsage.new.call(
          budget_records:,
          transactions:,
          space:
        )
        return nil unless usage_result.success?

        usage_values = usage_result.value!
        return nil if usage_values[:total_budget].zero?
        return nil if usage_values[:usage_percentage] > 100

        usage = usage_values[:usage_percentage]
        profile_card(
          profile_key: "balanced_budgeter",
          title: is_business ? "On-Budget Operator" : "Balanced Budgeter",
          body: "You stayed at #{Utils::Number.format_percentage(usage)} of budget this period — disciplined and on track.",
          action_label: "Review budgets",
          action_href: "/dashboard/budgets"
        )
      end

      def avid_spender_card(income:, expenses:, net:, is_business:)
        return nil if income.zero? || expenses.zero?

        share = (expenses / income) * 100
        return nil if share < AVID_SPENDER_EXPENSE_SHARE

        body = if net.negative?
                 "You put #{Utils::Number.format_percentage(share)} of #{is_business ? 'revenue' : 'income'} into action this period — living your money. Keep an eye on the buffer."
        else
                 "You put #{Utils::Number.format_percentage(share)} of #{is_business ? 'revenue' : 'income'} into action this period — living your money with intention."
        end

        profile_card(
          profile_key: "avid_spender",
          title: is_business ? "Active Operator" : "Avid Spender",
          body:,
          action_label: "View transactions",
          action_href: "/dashboard"
        )
      end

      def investment_activity_amount(space:, transactions:, start_date:, end_date:)
        investment_account_ids = space.accounts.kept.where(account_category: :investment).pluck(:id)
        total = 0.to_d

        Array(transactions).each do |tx|
          next unless tx.is_a?(Transactions::Expense)

          amount = tx.amount_numeric_for_space_total.to_d.abs
          category_name = category_label(tx)
          on_investment_account = investment_account_ids.include?(tx.account_id)
          investment_category = category_name.match?(INVESTMENT_CATEGORY_PATTERN)
          total += amount if on_investment_account || investment_category
        end

        return total if investment_account_ids.empty?

        total + transfer_inflows_to_investment(
          space:,
          investment_account_ids:,
          start_date:,
          end_date:
        )
      end

      def transfer_inflows_to_investment(space:, investment_account_ids:, start_date:, end_date:)
        Transactions::Transfer
          .where(space_id: space.id, to_account_id: investment_account_ids)
          .where(date: start_date..end_date)
          .sum { |transfer| transfer.amount_numeric_for_space_total.to_d.abs }
      end

      def prior_period_income(params:)
        period_days = params[:period_days]
        prior_end = params[:start_date] - 1.day
        prior_start = prior_end - (period_days - 1).days

        prior = Insights::Operations::CreateSummaryStructure.new.call(
          space: params[:space],
          start_date: prior_start,
          end_date: prior_end,
          category_filtered: false,
          transactions: params[:prior_transactions]
        )
        return 0.to_d unless prior.success?

        decimal_from(prior.value![:total_income])
      end

      def category_label(transaction)
        if transaction.respond_to?(:category_name) && transaction.category_name.present?
          return transaction.category_name
        end

        transaction.category&.name || "Uncategorized"
      end

      def profile_card(profile_key:, title:, body:, action_label:, action_href:)
        {
          type: "profile",
          severity: "positive",
          title:,
          body:,
          action_label:,
          action_href:,
          profile_key:,
          image_key: profile_key
        }
      end

      def decimal_from(value)
        return value if value.is_a?(BigDecimal)
        return BigDecimal(value.to_s) if value.is_a?(Numeric)

        BigDecimal(value.to_s.delete(","))
      end

      def format_money(amount, currency)
        code = currency.presence || "PHP"
        formatted = Money.from_amount(amount.to_f, code).format(symbol: false)

        "#{code} #{formatted}"
      end
    end
  end
end
