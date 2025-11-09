# frozen_string_literal: true

module Entities
  module Serializers
    class EntitySerializer < Blueprinter::Base
      identifier :id

      fields :full_name, :entity_type
    end
  end
end
