# frozen_string_literal: true

module Spaces
  class Space < ApplicationRecord
    has_many :transactions, class_name: "Transactions::Transaction", dependent: :destroy
    has_many :space_users, class_name: "Spaces::SpaceUser", dependent: :destroy
    has_many :users, class_name: "Auth::User", through: :space_users
    has_many :categories, class_name: "Transactions::Category", dependent: :destroy

    validates :name, presence: true
    validates :code, presence: true, uniqueness: true
    validates :currency, presence: true
    validates :type, presence: true, inclusion: { in: %w[Spaces::PersonalSpace Spaces::OrganizationSpace] }

    after_create :create_default_transaction_categories

    def create_default_transaction_categories
      Transactions::Category.create_default_categories(self)
    end
  end
end
