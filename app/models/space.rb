# frozen_string_literal: true

class Space < ApplicationRecord
  has_many :transactions, dependent: :destroy
  has_many :space_users, dependent: :destroy
  has_many :users, through: :space_users

  validates :name, presence: true
  validates :code, presence: true, uniqueness: true
  validates :currency, presence: true
  validates :type, presence: true, inclusion: { in: %w[Spaces::PersonalSpace Spaces::OrganizationSpace] }
end
