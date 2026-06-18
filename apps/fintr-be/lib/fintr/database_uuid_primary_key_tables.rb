# frozen_string_literal: true

module Fintr
  module DatabaseUuidPrimaryKeyTables
    TABLES = %w[
      accounts
      entities
      loan_payments
      loans
      spaces
      transactions
      transactions_categories
      transfers
    ].freeze
  end
end
