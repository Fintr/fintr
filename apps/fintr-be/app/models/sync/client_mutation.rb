# frozen_string_literal: true

module Sync
  class ClientMutation < ApplicationRecord
    self.table_name = "sync_client_mutations"

    belongs_to :space, class_name: "Spaces::Space"

    validates :client_mutation_id,
              presence: true,
              uniqueness: { scope: :space_id }
    validates :resource_type, presence: true
    validates :resource_id, presence: true
  end
end
