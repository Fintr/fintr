# frozen_string_literal: true

module Achievements
  class Achievement < ApplicationRecord
    self.table_name = "achievements"

    KINDS = %w[identity collectible].freeze
    RARITIES = %w[common uncommon rare epic].freeze
    CATEGORIES = %w[
      transactions
      budgets
      collaboration
      loans
      loan_payments
      transfers
    ].freeze

    CATEGORY_ORDER = CATEGORIES.each_with_index.to_h.freeze

    has_many :user_achievements,
             class_name: "Achievements::UserAchievement",
             dependent: :destroy
    has_many :users,
             through: :user_achievements,
             class_name: "Auth::User"

    validates :key, presence: true, uniqueness: true
    validates :title, presence: true
    validates :image_key, presence: true
    validates :unlock_event, presence: true
    validates :kind, inclusion: { in: KINDS }
    validates :rarity, inclusion: { in: RARITIES }
    validates :category, inclusion: { in: CATEGORIES }
    validates :xp_reward, numericality: { greater_than_or_equal_to: 0 }
    validates :position, numericality: { greater_than_or_equal_to: 0 }

    scope :active, -> { where(active: true) }
    scope :collectible, -> { where(kind: "collectible") }
    scope :for_event, ->(event) { active.where(unlock_event: event) }
    scope :ordered, -> { in_order_of(:category, CATEGORIES).order(:position, :title) }
  end
end
