# frozen_string_literal: true

module Entities
  module Serializers
    class MerchantAliasSerializer < Blueprinter::Base
      identifier :id

      field :label do |record|
        record.label.presence || record.scanned_name
      end

      field :scanned_name
    end
  end
end
