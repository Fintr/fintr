# frozen_string_literal: true

module Insights
  module Operations
    class CreateNarratives < Dry::Operation
      BUSINESS_COGS_PATTERN = /inventory|supplies|materials|cogs|cost of goods|raw materials/i
      EMERGENCY_FUND_LOOKBACK_MONTHS = 12
      MAX_INSIGHTS = 3

      class Contract < Dry::Validation::Contract
        params do
          required(:space)
          required(:transactions)
          required(:prior_transactions)
          required(:budgets)
          required(:budget_records)
          required(:summary_structure)
          required(:health_scores)
          required(:is_business).value(:bool)
          required(:start_date).value(:date)
          required(:end_date).value(:date)
          required(:period_days).value(:integer)
        end
      end

      def call(params)
        params = step validate(params:)
        metrics = step build_metrics(params:)
        insights = step build_insights(params:, metrics:)
        headline = step build_headline(params:, metrics:)
        data_quality = step build_data_quality(params:)
        {
          headline:,
          metrics:,
          insights:,
          data_quality:
        }
      end

      private

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      def build_metrics(params:)
        space = params[:space]
        summary = params[:summary_structure]
        prior_summary = prior_period_summary(
          transactions: params[:prior_transactions],
          space:
        )

        income = decimal_from(summary[:total_income])
        expenses = decimal_from(summary[:total_expenses])
        net = decimal_from(summary[:net_savings])
        prior_income = decimal_from(prior_summary[:total_income])
        prior_net = decimal_from(prior_summary[:net_savings])
        prior_expenses = decimal_from(prior_summary[:total_expenses])

        savings_rate = income.zero? ? 0.to_d : (net / income * 100)
        prior_savings_rate = prior_income.zero? ? 0.to_d : (prior_net / prior_income * 100)
        trailing_expenses = step resolve_emergency_fund_expenses(params:)
        emergency_months = step emergency_fund_months(
          space:,
          trailing_expenses:
        )

        metrics = [
          metric_row(
            key: "savings_rate",
            label: params[:is_business] ? "Net margin" : "Savings rate",
            value: Utils::Number.format_percentage(savings_rate),
            benchmark: params[:is_business] ? "15–25%" : "10–20%",
            trend: flow_icon_for_change(
              current: savings_rate,
              prior: prior_savings_rate,
              rising_means: :income
            ),
            calculation: savings_rate_calculation(
              space:,
              income:,
              expenses:,
              net:,
              savings_rate:,
              prior_income:,
              prior_savings_rate:,
              is_business: params[:is_business]
            )
          ),
          metric_row(
            key: "emergency_fund",
            label: params[:is_business] ? "Cash runway" : "Emergency fund",
            value: emergency_months[:display],
            benchmark: params[:is_business] ? "8+ weeks" : "3–6 months",
            trend: nil,
            calculation: emergency_fund_calculation(
              space:,
              emergency_months:,
              lookback_start_date: emergency_fund_lookback_start_date(
                end_date: params[:end_date]
              ),
              lookback_end_date: params[:end_date]
            )
          )
        ]

        if params[:is_business]
          business = business_margins(transactions: params[:transactions], space:, income:)
          metrics.unshift(
            metric_row(
              key: "gross_margin",
              label: "Gross margin",
              value: Utils::Number.format_percentage(business[:gross_margin]),
              benchmark: "30%+",
              trend: nil,
              calculation: gross_margin_calculation(
                space:,
                business:,
                income:
              )
            )
          )
        end

        expense_change = percent_change(current: expenses, prior: prior_expenses)
        if expense_change
          metrics << metric_row(
            key: "expense_change",
            label: "Expense vs prior period",
            value: expense_change_label(expense_change),
            benchmark: "Stable",
            trend: flow_icon_for_change(
              current: expenses,
              prior: prior_expenses,
              rising_means: :expense
            ),
            calculation: expense_change_calculation(
              space:,
              current: expenses,
              prior: prior_expenses,
              change: expense_change
            )
          )
        end

        Success(metrics)
      end

      def build_insights(params:, metrics:)
        cards = []
        space = params[:space]
        summary = params[:summary_structure]
        income = decimal_from(summary[:total_income])
        expenses = decimal_from(summary[:total_expenses])
        net = decimal_from(summary[:net_savings])

        cards << savings_insight(
          is_business: params[:is_business],
          income:,
          net:,
          savings_rate: income.zero? ? 0 : (net / income * 100)
        )

        cards.concat(
          budget_insights(
            budget_records: params[:budget_records],
            transactions: params[:transactions],
            space: params[:space]
          )
        )
        cards << debt_insight(health_scores: params[:health_scores], is_business: params[:is_business])
        cards.concat(category_spike_insights(
          transactions: params[:transactions],
          prior_transactions: params[:prior_transactions],
          space:
        ))

        if params[:is_business] && income.positive?
          business = business_margins(transactions: params[:transactions], space:, income:)
          cards << business_margin_insight(business:, income:)
        end

        cards.compact!
        cards.sort_by! { |c| severity_rank(c[:severity]) }
        Success(cards.first(MAX_INSIGHTS))
      end

      def build_headline(params:, metrics:)
        summary = params[:summary_structure]
        net = decimal_from(summary[:net_savings])
        currency = params[:space].currency.presence || "PHP"
        formatted_net = format_money(net, currency)

        text = if params[:is_business]
                 if net >= 0
                   "Profitable period — net #{formatted_net} after expenses."
                 else
                   "Cash negative this period — net #{formatted_net}. Review operating costs."
                 end
        elsif net >= 0
                 "You kept #{formatted_net} this period."
        else
                 "You spent #{format_money(net.abs, currency)} more than you earned."
        end

        sentiment = net >= 0 ? "positive" : "negative"
        Success(text:, sentiment:)
      end

      def build_data_quality(params:)
        transactions = params[:transactions]
        count = transaction_scope_count(transactions)
        categorized = categorized_scope_count(transactions)
        categorized_percent = count.zero? ? 0 : (categorized.to_d / count * 100)

        tier = if count < 10
                 "sparse"
        elsif count < 30 || categorized_percent < 70
                 "building"
        else
                 "complete"
        end

        Success(
          transaction_count: count,
          categorized_percent: Utils::Number.format_percentage(categorized_percent),
          completeness_tier: tier
        )
      end

      def resolve_emergency_fund_expenses(params:)
        space = params[:space]
        end_date = params[:end_date]
        start_date = emergency_fund_lookback_start_date(end_date:)
        transactions = step find_emergency_fund_transactions(
          space:,
          start_date:,
          end_date:
        )
        summary = Insights::Operations::CreateSummaryStructure.new.call(
          transactions:,
          space:
        )
        return summary unless summary.success?

        Success(decimal_from(summary.value![:total_expenses]))
      end

      def find_emergency_fund_transactions(space:, start_date:, end_date:)
        Transactions::Queries::FilteredTransactions.call(
          params: {
            space_code: space.code,
            start_date:,
            end_date:,
            balance_state: "calculated",
            paginate: false,
            without_initial_balance: true
          }
        )
      end

      def emergency_fund_lookback_start_date(end_date:)
        (end_date - EMERGENCY_FUND_LOOKBACK_MONTHS.months + 1.day).to_date
      end

      def emergency_fund_months(space:, trailing_expenses:)
        liquid_cents = space.accounts.kept.sum { |a| a.balance.cents }
        liquid = liquid_cents / 100.0
        months_in_period = EMERGENCY_FUND_LOOKBACK_MONTHS.to_d
        period_expenses = trailing_expenses.to_d
        monthly_expenses = period_expenses / months_in_period

        if monthly_expenses.zero?
          return Success(
            display: "—",
            months: 0.to_d,
            liquid: liquid.to_d,
            period_expenses:,
            monthly_expenses:,
            months_in_period:
          )
        end

        months = liquid / monthly_expenses
        display = if space.is_a?(Spaces::OrganizationSpace)
                    weeks = (months * 4.33).round(1)
                    "#{weeks} weeks"
        else
                    "#{months.round(1)} months"
        end
        Success(
          display:,
          months:,
          liquid: liquid.to_d,
          period_expenses:,
          monthly_expenses:,
          months_in_period:
        )
      end

      def prior_period_summary(transactions:, space:)
        income_op = Insights::Operations::CreateSummaryStructure.new
        result = income_op.call(transactions:, space:)
        return { total_income: 0, total_expenses: 0, net_savings: 0 } unless result.success?

        result.value!
      end

      def business_margins(transactions:, space:, income:)
        cogs = 0.to_d
        expenses = transactions.to_a.select { |tx| tx.is_a?(Transactions::Expense) }
        expenses.each do |tx|
          name = category_label(tx)
          amount = Insights::SpaceCurrencyAmount.to_space_decimal(
            money: tx.expense,
            date: tx.date.to_date,
            space:,
            strict: true
          )
          cogs += amount if name.match?(BUSINESS_COGS_PATTERN)
        end

        gross_profit = income - cogs
        gross_margin = income.zero? ? 0 : (gross_profit / income * 100)
        { gross_margin:, cogs:, gross_profit: }
      end

      def savings_insight(is_business:, income:, net:, savings_rate:)
        return nil if income.zero?

        if savings_rate >= 20
          severity = "positive"
          title = is_business ? "Healthy net margin" : "Strong savings rate"
          body = "You retained #{Utils::Number.format_percentage(savings_rate)} of #{is_business ? 'revenue' : 'income'} this period."
        elsif savings_rate >= 10
          severity = "neutral"
          title = is_business ? "Moderate profitability" : "Room to save more"
          body = "You retained #{Utils::Number.format_percentage(savings_rate)}. Aim for #{is_business ? '15–25%' : '10–20%'} to build a stronger buffer."
        else
          severity = "warning"
          title = is_business ? "Thin margins" : "Low savings rate"
          body = net.negative? ? "Expenses exceeded income. Review your largest spending categories." : "Consider trimming discretionary spending to improve cash flow."
        end

        insight_card(
          type: "savings",
          severity:,
          title:,
          body:,
          action_label: "View transactions",
          action_href: "/dashboard"
        )
      end

      def budget_insights(budget_records:, transactions:, space:)
        return [] if budget_records.blank?

        usage_result = Insights::Operations::ComputeBudgetUsage.new.call(
          budget_records:,
          transactions:,
          space:
        )
        return [] unless usage_result.success?

        usage_values = usage_result.value!
        return [] if usage_values[:total_budget].zero?

        usage = usage_values[:usage_percentage]
        return [] if usage < 100

        over = usage_values[:over_amount]
        currency = budget_records.first.amount.currency.iso_code
        [
          insight_card(
            type: "budget",
            severity: usage >= 120 ? "warning" : "neutral",
            title: "Over budget",
            body: "You've used #{Utils::Number.format_percentage(usage)} of your budget (#{format_money(over, currency)} over).",
            action_label: "Review budgets",
            action_href: "/dashboard/budgets"
          )
        ]
      end

      def debt_insight(health_scores:, is_business:)
        dti = health_scores[:debt_to_income_ratio]
        percentage_str = dti[:percentage] || "0%"
        ratio = percentage_str.to_s.delete("%").to_f
        return nil if ratio.zero?

        severity = ratio >= 40 ? "warning" : (ratio >= 30 ? "neutral" : "positive")
        insight_card(
          type: "debt",
          severity:,
          title: is_business ? "Debt service load" : "Debt-to-income",
          body: "Estimated debt payments are #{percentage_str} of monthly income. Lenders often prefer below 36%.",
          action_label: "View loans",
          action_href: "/dashboard/loans"
        )
      end

      def category_spike_insights(transactions:, prior_transactions:, space:)
        current = expenses_by_category(transactions:, space:)
        prior = expenses_by_category(transactions: prior_transactions, space:)
        spikes = []

        current.each do |name, amount|
          prior_amount = prior[name] || 0
          next if prior_amount.zero? || amount <= prior_amount

          change = ((amount - prior_amount) / prior_amount * 100)
          next if change < 15

          spikes << insight_card(
            type: "category_trend",
            severity: change >= 30 ? "warning" : "neutral",
            title: "#{name} spending up",
            body: "#{name} is #{Utils::Number.format_percentage(change)} higher than the prior period.",
            action_label: "Filter transactions",
            action_href: transactions_filter_href(category_name: name)
          )
        end

        spikes.sort_by { |s| -s[:body].length }.first(1)
      end

      def business_margin_insight(business:, income:)
        margin = business[:gross_margin]
        return nil if margin >= 30

        insight_card(
          type: "margin",
          severity: margin < 15 ? "warning" : "neutral",
          title: "Gross margin below target",
          body: "Gross margin is #{Utils::Number.format_percentage(margin)}. Tag inventory and supply costs as COGS categories to sharpen this metric.",
          action_label: "Manage categories",
          action_href: "/dashboard/space_settings/categories"
        )
      end

      def expenses_by_category(transactions:, space:)
        totals = Hash.new(0.to_d)
        transactions.to_a.each do |tx|
          next unless tx.is_a?(Transactions::Expense)

          name = category_label(tx)
          totals[name] += Insights::SpaceCurrencyAmount.to_space_decimal(
            money: tx.expense,
            date: tx.date.to_date,
            space:,
            strict: true
          )
        end
        totals
      end

      def category_label(transaction)
        if transaction.respond_to?(:category_name) && transaction.category_name.present?
          return transaction.category_name
        end

        transaction.category&.name || "Uncategorized"
      end

      def metric_row(key:, label:, value:, benchmark:, trend:, calculation: nil)
        { key:, label:, value:, benchmark:, trend:, calculation: }
      end

      def calculation_input(label:, value:)
        { label:, value: }
      end

      def calculation_block(labeled_formula:, formula: nil, inputs:, notes: [])
        { labeled_formula:, formula:, inputs:, notes: }
      end

      def savings_rate_calculation(
        space:,
        income:,
        expenses:,
        net:,
        savings_rate:,
        prior_income:,
        prior_savings_rate:,
        is_business:
      )
        currency = space.currency.presence || "PHP"
        income_label = is_business ? "Revenue" : "Total income"
        net_label = is_business ? "Net profit" : "Net savings"
        rate_label = is_business ? "Net margin" : "Savings rate"

        inputs = [
          calculation_input(label: income_label, value: format_money(income, currency)),
          calculation_input(label: "Total expenses", value: format_money(expenses, currency)),
          calculation_input(label: net_label, value: format_money(net, currency)),
          calculation_input(label: rate_label, value: Utils::Number.format_percentage(savings_rate))
        ]

        if prior_income.positive?
          inputs << calculation_input(
            label: "Prior period #{rate_label.downcase}",
            value: Utils::Number.format_percentage(prior_savings_rate)
          )
        end

        labeled_formula = "(#{net_label} ÷ #{income_label}) × 100"
        value_formula =
          unless income.zero?
            "#{format_money(net, currency)} ÷ #{format_money(income, currency)} × 100 = #{Utils::Number.format_percentage(savings_rate)}"
          end

        calculation_block(
          labeled_formula:,
          formula: value_formula,
          inputs:,
          notes: [
            income.zero? ? "No income in this period, so the rate shows as 0%." : "Uses transactions in your selected date range.",
            "The flow icon compares this period’s rate to the prior period of equal length."
          ]
        )
      end

      def emergency_fund_calculation(space:, emergency_months:, lookback_start_date:, lookback_end_date:)
        currency = space.currency.presence || "PHP"
        liquid = emergency_months[:liquid]
        period_expenses = emergency_months[:period_expenses]
        monthly_expenses = emergency_months[:monthly_expenses]
        months_in_period = emergency_months[:months_in_period]
        display = emergency_months[:display]
        fund_label = space.is_a?(Spaces::OrganizationSpace) ? "Cash runway" : "Emergency fund"

        if monthly_expenses.zero?
          return calculation_block(
            labeled_formula: "Total cash ÷ Average monthly expenses",
            inputs: [
              calculation_input(label: "Total cash (all accounts)", value: format_money(liquid, currency)),
              calculation_input(
                label: "Expenses (last #{EMERGENCY_FUND_LOOKBACK_MONTHS} months)",
                value: format_money(period_expenses, currency)
              ),
              calculation_input(label: fund_label, value: display)
            ],
            notes: ["Add expenses in the last #{EMERGENCY_FUND_LOOKBACK_MONTHS} months to calculate coverage."]
          )
        end

        calculation_block(
          labeled_formula: "Total cash ÷ Average monthly expenses",
          formula: "#{format_money(liquid, currency)} ÷ #{format_money(monthly_expenses, currency)} = #{display}",
          inputs: [
            calculation_input(label: "Total cash (all accounts)", value: format_money(liquid, currency)),
            calculation_input(
              label: "Expenses (last #{EMERGENCY_FUND_LOOKBACK_MONTHS} months)",
              value: format_money(period_expenses, currency)
            ),
            calculation_input(
              label: "Avg monthly expenses",
              value: format_money(monthly_expenses, currency)
            ),
            calculation_input(label: fund_label, value: display)
          ],
          notes: [
            "Avg monthly expenses = expenses in the last #{EMERGENCY_FUND_LOOKBACK_MONTHS} months ÷ #{months_in_period.to_i} months (#{lookback_start_date}–#{lookback_end_date}).",
            "Cash is the sum of balances on all active accounts in this space.",
            "Independent of your selected insights date range."
          ]
        )
      end

      def expense_change_calculation(space:, current:, prior:, change:)
        currency = space.currency.presence || "PHP"

        calculation_block(
          labeled_formula: "(This period expenses − Prior period expenses) ÷ Prior period expenses × 100",
          formula: "(#{format_money(current, currency)} − #{format_money(prior, currency)}) ÷ #{format_money(prior, currency)} × 100 = #{Utils::Number.format_percentage(change)}",
          inputs: [
            calculation_input(label: "This period expenses", value: format_money(current, currency)),
            calculation_input(label: "Prior period expenses", value: format_money(prior, currency)),
            calculation_input(label: "Change", value: expense_change_label(change))
          ],
          notes: ["Prior period is the same number of days immediately before your selected range."]
        )
      end

      def gross_margin_calculation(space:, business:, income:)
        currency = space.currency.presence || "PHP"
        gross_profit = business[:gross_profit]
        cogs = business[:cogs]
        margin = business[:gross_margin]

        calculation_block(
          labeled_formula: "(Revenue − COGS) ÷ Revenue × 100",
          formula: "#{format_money(gross_profit, currency)} ÷ #{format_money(income, currency)} × 100 = #{Utils::Number.format_percentage(margin)}",
          inputs: [
            calculation_input(label: "Revenue", value: format_money(income, currency)),
            calculation_input(label: "COGS", value: format_money(cogs, currency)),
            calculation_input(label: "Gross profit", value: format_money(gross_profit, currency)),
            calculation_input(label: "Gross margin", value: Utils::Number.format_percentage(margin))
          ],
          notes: [
            "COGS includes expense categories matching inventory, supplies, materials, and similar names."
          ]
        )
      end

      def transactions_filter_href(category_name: nil)
        return "/dashboard" if category_name.blank?

        "/dashboard?#{URI.encode_www_form(category: category_name)}"
      end

      def insight_card(type:, severity:, title:, body:, action_label:, action_href:)
        {
          type:,
          severity:,
          title:,
          body:,
          action_label:,
          action_href:
        }
      end

      def severity_rank(severity)
        { "warning" => 0, "neutral" => 1, "positive" => 2 }[severity] || 3
      end

      def decimal_from(value)
        return value if value.is_a?(BigDecimal)
        return BigDecimal(value.to_s) if value.is_a?(Numeric)

        BigDecimal(value.to_s.delete(","))
      end

      def percent_change(current:, prior:)
        return nil if prior.zero?

        ((current - prior) / prior * 100)
      end

      # Matches transaction list icons: "income" => ArrowUpRight (teal), "expense" => ArrowDownLeft (red).
      def expense_change_label(change)
        magnitude = Utils::Number.format_percentage(change.abs)
        change.negative? ? "#{magnitude} less" : "#{magnitude} more"
      end

      def flow_icon_for_change(current:, prior:, rising_means:)
        change = percent_change(current:, prior:)
        return nil if change.nil? || change.zero?

        rose = change.positive?
        if rising_means == :expense
          rose ? "expense" : "income"
        else
          rose ? "income" : "expense"
        end
      end

      def format_money(amount, currency)
        Money.from_amount(amount.to_f, currency).format
      end

      def transaction_scope_count(transactions)
        return transactions.size unless transactions.is_a?(ActiveRecord::Relation)

        # FilteredTransactions applies a custom SELECT; COUNT on that relation
        # generates invalid SQL (PG syntax error near "as").
        transactions.unscope(:select, :order).count
      end

      def categorized_scope_count(transactions)
        return transactions.count { |tx| tx.category_id.present? } unless transactions.is_a?(ActiveRecord::Relation)

        transactions.unscope(:select, :order).where.not(category_id: nil).count
      end
    end
  end
end
