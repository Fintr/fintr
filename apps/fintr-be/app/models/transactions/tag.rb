# frozen_string_literal: true

module Transactions
  class Tag < ApplicationRecord
    self.table_name = "transactions_tags"

    belongs_to :space, class_name: "Spaces::Space"
    has_many :transaction_taggings,
             class_name: "Transactions::TransactionTagging",
             foreign_key: :tag_id,
             dependent: :destroy,
             inverse_of: :tag
    has_many :transactions,
             through: :transaction_taggings,
             class_name: "Transactions::Transaction"
    has_one_attached :style_image

    validates :name, presence: true
    validates :name,
              uniqueness: {
                scope: :space_id,
                message: "already exists for this space",
              }
    validates :color,
              presence: true,
              format: {
                with: CategoryAppearance::COLOR_FORMAT,
                message: "must be a valid hex color",
              }

    before_validation :assign_default_color, on: :create

    private

    def assign_default_color
      return if color.present?

      seed = name.to_s.bytes.sum
      self.color = CategoryAppearance::PALETTE[seed % CategoryAppearance::PALETTE.length]
    end
  end
end
