# frozen_string_literal: true

module Transactions
  class LoanVersion < ApplicationRecord
    include PaperTrail::VersionConcern

    self.table_name = :loan_versions
  end
end
