# frozen_string_literal: true

class AddSubscriptionTypeToFinanceSpaceSubscriptions < ActiveRecord::Migration[8.1]
  def up
    unless finance_space_subscription_type_enum_exists?
      create_enum :finance_space_subscription_type, %w[paid sponsor free]
    end

    return if column_exists?(:finance_space_subscriptions, :subscription_type)

    add_column :finance_space_subscriptions, :subscription_type, :enum,
               enum_type: :finance_space_subscription_type,
               null: false,
               default: "paid"

    add_index :finance_space_subscriptions, :subscription_type,
              name: "index_finance_space_subscriptions_on_subscription_type",
              if_not_exists: true
  end

  def down
    remove_index :finance_space_subscriptions,
                 name: "index_finance_space_subscriptions_on_subscription_type",
                 if_exists: true

    return unless column_exists?(:finance_space_subscriptions, :subscription_type)

    remove_column :finance_space_subscriptions, :subscription_type

    return unless finance_space_subscription_type_enum_exists?

    execute "DROP TYPE IF EXISTS finance_space_subscription_type"
  end

  private

  def finance_space_subscription_type_enum_exists?
    ActiveRecord::Type::Boolean.new.cast(
      connection.select_value(
        "SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'finance_space_subscription_type')"
      )
    )
  end
end
