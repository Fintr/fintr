# frozen_string_literal: true

module Transactions
  class AccountVersion < ApplicationRecord
    include PaperTrail::VersionConcern

    self.table_name = :account_versions
  end
end
