# frozen_string_literal: true

module Entities
  module Serializers
    class EntitySerializer < Blueprinter::Base
      identifier :id

      fields :full_name, :entity_type

      field :photo_url do |entity|
        next unless entity.photo.attached?

        entity.photo.url
      end
    end
  end
end
