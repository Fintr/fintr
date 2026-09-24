# frozen_string_literal: true

module Transactions
  class TagStylePresets
    KEYS = %w[
      japan-vacation
      europe-vacation
      beach-vacation
      road-trip
      wedding
      new-baby
      home-renovation
      moving
      pet
      car
      medical
      education
      business-trip
      holidays
      birthday
      side-hustle
      fitness
      concert
      family
      new-home
    ].freeze

    def self.valid?(key)
      KEYS.include?(key)
    end
  end
end
