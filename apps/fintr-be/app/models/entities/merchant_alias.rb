# frozen_string_literal: true

module Entities
  class MerchantAlias < ApplicationRecord
    self.table_name = "entity_merchant_aliases"

    belongs_to :space, class_name: "Spaces::Space"
    belongs_to :entity, class_name: "Entities::Entity"

    validates :scanned_name, presence: true
    validates :scanned_name,
              uniqueness: {
                scope: :space_id,
                message: "already mapped for this space",
              }

    before_validation :normalize_scanned_name

    def self.normalize_name(name)
      name.to_s.strip.downcase.squeeze(" ")
    end

    private

    def normalize_scanned_name
      self.label = scanned_name.to_s.strip if label.blank? && scanned_name.present?
      self.scanned_name = self.class.normalize_name(scanned_name)
    end
  end
end
