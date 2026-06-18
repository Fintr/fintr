# frozen_string_literal: true

module Transactions
  class LoanPaymentVersion < ApplicationRecord
    include PaperTrail::VersionConcern

    self.table_name = :loan_payment_versions
  end
end
