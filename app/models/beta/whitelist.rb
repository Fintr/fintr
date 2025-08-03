# frozen_string_literal: true

module Beta
  class Whitelist < ApplicationRecord
    self.table_name = "beta_whitelists"

    validates :email, presence: true, uniqueness: true
  end
end
