# frozen_string_literal: true

module Sync
  class SpaceSequence < ApplicationRecord
    self.table_name = "space_sync_sequences"

    belongs_to :space, class_name: "Spaces::Space"

    validates :space_id, presence: true, uniqueness: true
    validates :last_seq, numericality: { greater_than_or_equal_to: 0 }
  end
end
