# frozen_string_literal: true

module Transactions
  module Serializers
    class TagSerializer < Blueprinter::Base
      identifier :id

      fields :name, :color, :is_default

      field :style_image_url do |tag|
        next unless tag.style_image.attached?

        tag.style_image.url
      end
    end
  end
end
