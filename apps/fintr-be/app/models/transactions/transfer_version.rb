# frozen_string_literal: true

module Transactions
  class TransferVersion < ApplicationRecord
    include PaperTrail::VersionConcern

    self.table_name = :transfer_versions
  end
end
