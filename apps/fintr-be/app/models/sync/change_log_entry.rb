# frozen_string_literal: true

module Sync
  class ChangeLogEntry < ApplicationRecord
    self.table_name = "space_change_log"

    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :actor_user, class_name: "Auth::User", optional: true

    validates :space_id, :seq, :op, presence: true
    validates :seq, uniqueness: { scope: :space_id }
  end
end
