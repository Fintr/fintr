# frozen_string_literal: true

module Transactions
  class TransactionVersion < ApplicationRecord
    include PaperTrail::VersionConcern

    self.table_name = :transaction_versions
  end
end
