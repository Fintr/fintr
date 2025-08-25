# frozen_string_literal: true

module Admin
  module Serializers
    class UserSerializer < Blueprinter::Base
      identifier :id

      fields :email, :full_name
    end
  end
end
