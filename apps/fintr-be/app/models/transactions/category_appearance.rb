# frozen_string_literal: true

module Transactions
  module CategoryAppearance
    ICON_FORMAT = /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/
    COLOR_FORMAT = /\A#[0-9A-Fa-f]{6}\z/

    DEFAULT_ICON = "tag"
    DEFAULT_COLOR = "#0A3D62"

    PALETTE = %w[
      #0A3D62
      #1E88E5
      #43A047
      #F9A825
      #E53935
      #8E24AA
      #00897B
      #FB8C00
      #5E35B1
      #3949AB
      #C2185B
      #6D4C41
    ].freeze

    DEFAULTS_BY_NAME = {
      "Salary" => { icon: "briefcase", color: "#1E88E5" },
      "Freelance" => { icon: "laptop", color: "#43A047" },
      "Business" => { icon: "building-2", color: "#5E35B1" },
      "Initial Balance" => { icon: "wallet", color: "#6D4C41" },
      "Income Adjustment" => { icon: "scale", color: "#F9A825" },
      "Family" => { icon: "users", color: "#C2185B" },
      "Insurance" => { icon: "shield", color: "#3949AB" },
      "Home" => { icon: "home", color: "#FB8C00" },
      "Utilities" => { icon: "zap", color: "#F9A825" },
      "Food & Groceries" => { icon: "shopping-cart", color: "#43A047" },
      "Transport" => { icon: "car", color: "#1E88E5" },
      "Pet" => { icon: "dog", color: "#6D4C41" },
      "Subscriptions & Hobbies" => { icon: "gamepad-2", color: "#8E24AA" },
      "Dine Out & Entertainment" => { icon: "utensils", color: "#E53935" },
      "Travel & Vacations" => { icon: "plane", color: "#00897B" },
      "Shopping" => { icon: "shopping-bag", color: "#C2185B" },
      "Transfer Fee" => { icon: "arrow-left-right", color: "#6D4C41" },
  "Expense Adjustment" => { icon: "scale", color: "#F9A825" },
  "Loan" => { icon: "landmark", color: "#3949AB" },
  "Loan payment" => { icon: "landmark", color: "#3949AB" },
}.freeze

    module_function

    def resolve(name:, category_type:, icon: nil, color: nil)
      defaults = DEFAULTS_BY_NAME[name] || generated_defaults(name:, category_type:)

      {
        icon: normalize_icon(icon) || defaults[:icon],
        color: normalize_color(color) || defaults[:color],
      }
    end

    def normalize_icon(value)
      return nil if value.blank?
      return value if value.match?(ICON_FORMAT)

      nil
    end

    def normalize_color(value)
      return nil if value.blank?
      return value.upcase if value.match?(COLOR_FORMAT)

      nil
    end

    def generated_defaults(name:, category_type:)
      seed = "#{category_type}:#{name}".bytes.sum
      {
        icon: DEFAULT_ICON,
        color: PALETTE[seed % PALETTE.length],
      }
    end
  end
end
