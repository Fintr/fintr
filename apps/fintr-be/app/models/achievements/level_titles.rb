# frozen_string_literal: true

module Achievements
  module LevelTitles
    # Titles unlock as the user levels up. Current title = highest unlocked by level.
    LADDER = [
      {
        level: 1,
        key: "rookie_tracker",
        title: "Rookie Tracker",
        description: "You opened the books. Every legend starts here.",
        image_key: "rookie_tracker",
      },
      {
        level: 2,
        key: "receipt_rookie",
        title: "Receipt Rookie",
        description: "Logging spends like it is second nature.",
        image_key: "receipt_rookie",
      },
      {
        level: 3,
        key: "steady_logger",
        title: "Steady Logger",
        description: "Consistency unlocked. Your ledger stays warm.",
        image_key: "steady_logger",
      },
      {
        level: 4,
        key: "fierce_budgeter",
        title: "Fierce Budgeter",
        description: "Budgets fear you. Categories fall in line.",
        image_key: "fierce_budgeter",
      },
      {
        level: 5,
        key: "super_saver",
        title: "Super Saver",
        description: "Savings streaks and surplus energy.",
        image_key: "super_saver",
      },
      {
        level: 6,
        key: "goal_getter",
        title: "Goal Getter",
        description: "Targets set, progress chased, wins stacked.",
        image_key: "goal_getter",
      },
      {
        level: 7,
        key: "cashflow_captain",
        title: "Cashflow Captain",
        description: "Money in, money out — you run the ship.",
        image_key: "cashflow_captain",
      },
      {
        level: 8,
        key: "ledger_legend",
        title: "Ledger Legend",
        description: "Your history is clean, complete, and proud.",
        image_key: "ledger_legend",
      },
      {
        level: 9,
        key: "wealth_weaver",
        title: "Wealth Weaver",
        description: "Threads of income and spend woven into order.",
        image_key: "wealth_weaver",
      },
      {
        level: 10,
        key: "money_maestro",
        title: "Money Maestro",
        description: "Peak Fintr form. Conduct the whole orchestra.",
        image_key: "money_maestro",
      },
    ].freeze

    module_function

    def for_level(level:)
      capped = [ [ level.to_i, 1 ].max, LADDER.last[:level] ].min
      LADDER.reverse.find { |entry| entry[:level] <= capped } || LADDER.first
    end

    def ladder_for(level:)
      LADDER.map do |entry|
        entry.merge(unlocked: entry[:level] <= level.to_i)
      end
    end
  end
end
