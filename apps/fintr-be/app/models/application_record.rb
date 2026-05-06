# frozen_string_literal: true

class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  def self.clean_attributes
    (attribute_names - ["id", "created_at", "updated_at"]).map(&:to_sym)
  end
end
