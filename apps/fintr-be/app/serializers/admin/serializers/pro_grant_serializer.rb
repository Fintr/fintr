# frozen_string_literal: true

module Admin
  module Serializers
    class ProGrantSerializer < Blueprinter::Base
      identifier :id

      field :email do |grant|
        grant.user.email
      end

      field :expires_at
      field :acknowledged_at
      field :updated_at
    end
  end
end
