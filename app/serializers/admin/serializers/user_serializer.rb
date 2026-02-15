# frozen_string_literal: true

module Admin
  module Serializers
    class UserSerializer < Blueprinter::Base
      identifier :id

      field :email do |user|
        user.email
      end

      field :full_name do |user|
        user.full_name.presence || "-"
      end
    end
  end
end
