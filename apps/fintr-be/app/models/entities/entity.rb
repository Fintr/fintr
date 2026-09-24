# frozen_string_literal: true

module Entities
  class Entity < ApplicationRecord
    has_one_attached :photo

    belongs_to :space, class_name: "Spaces::Space"
    has_many :loans,
             class_name: "Transactions::Loan",
             foreign_key: :entity_id,
             dependent: :nullify
    has_many :transactions,
             class_name: "Transactions::Transaction",
             foreign_key: :entity_id,
             dependent: :nullify
    has_many :merchant_aliases,
             class_name: "Entities::MerchantAlias",
             foreign_key: :entity_id,
             dependent: :destroy

    validates :full_name, presence: true
    validates :entity_type, presence: true
    validates :full_name,
              uniqueness: {
                scope: [:space_id, :entity_type],
                message: "Already exists for this space"
              }

    scope :for_space, ->(space) { where(space:) }
    scope :for_type, ->(entity_type) { where(entity_type:) }
    scope :loans, -> { where(entity_type: "loan") }
    scope :transactions, -> { where(entity_type: "transaction") }

    def display_name
      full_name
    end
  end
end
